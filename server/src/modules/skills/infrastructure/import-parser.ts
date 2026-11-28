import { unzipSync } from 'fflate';
import { SKILL_LIMITS, SKILL_NAME_RE, SkillType } from '@devdigest/shared';
import { AppError } from '../../../platform/errors.js';
import type { ParsedSkillFile, SkillFileParser } from '../domain-services/ports.js';

/**
 * Import parser (spec M2 "Import"): `.md` with optional YAML frontmatter, or a
 * `.zip` holding `SKILL.md` at its root or under a single top folder. Everything
 * happens in memory: nothing from the upload is executed or written to disk.
 */

export const IMPORT_LIMITS = {
  /** A `.md` upload, and SKILL.md inside an archive. */
  fileBytes: 1024 * 1024,
  zipBytes: 5 * 1024 * 1024,
  zipEntries: 200,
  /** Sum of the declared uncompressed sizes (zip-bomb guard). */
  unpackedBytes: 10 * 1024 * 1024,
} as const;

const SKILL_FILE = 'skill.md';
const DEFAULT_TYPE: SkillType = 'custom';
const FALLBACK_NAME = 'imported-skill';
const KNOWN_KEYS = new Set(['name', 'description', 'type', 'allowed-tools']);
const EXECUTABLE_EXT =
  /\.(sh|bash|zsh|fish|py|js|mjs|cjs|ts|mts|cts|jsx|tsx|rb|pl|php|ps1|bat|cmd|exe|dll|so|dylib|bin|jar|wasm)$/i;

export class ImportRejectedError extends AppError {
  constructor(message: string, details?: unknown) {
    super('import_rejected', message, 422, details);
  }
}

// ---- frontmatter ----------------------------------------------------------

export interface Frontmatter {
  fields: Record<string, string | string[]>;
  body: string;
}

const unquote = (v: string): string => {
  const s = v.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return s.slice(1, -1);
  }
  return s;
};

/**
 * Minimal YAML frontmatter reader: `key: value`, quoted values, `|` / `>` block
 * scalars, `[a, b]` and `- item` lists. Enough for skill metadata; anything it
 * does not understand is kept as a raw string.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { fields: {}, body: src };
  const fields: Record<string, string | string[]> = {};
  const lines = m[1]!.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i]!);
    if (!kv) continue;
    const key = kv[1]!.toLowerCase();
    const raw = kv[2]!.trim();
    const nested: string[] = [];
    while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]!) || lines[i + 1] === '')) {
      nested.push(lines[++i]!);
    }
    if (raw === '|' || raw === '>' || /^[|>][+-]?$/.test(raw)) {
      const block = nested.map((l) => l.trim());
      fields[key] = (raw.startsWith('|') ? block.join('\n') : block.join(' ')).trim();
    } else if (raw === '' && nested.some((l) => /^\s*-\s+/.test(l))) {
      fields[key] = nested.filter((l) => /^\s*-\s+/.test(l)).map((l) => unquote(l.replace(/^\s*-\s+/, '')));
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      fields[key] = raw.slice(1, -1).split(',').map(unquote).filter(Boolean);
    } else {
      fields[key] = unquote([raw, ...nested.map((l) => l.trim())].filter(Boolean).join(' '));
    }
  }
  return { fields, body: src.slice(m[0].length) };
}

// ---- draft building -------------------------------------------------------

export function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_LIMITS.name)
    .replace(/-+$/, '');
}

const baseName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path;
const stripExt = (file: string) => file.replace(/\.[^.]+$/, '');

/** First non-heading paragraph of the body, whitespace collapsed. */
export function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text;
  }
  return '';
}

function buildDraft(
  markdown: string,
  fallbackName: string,
  skillPath: string,
  ignored: ParsedSkillFile['ignoredFiles'],
  warnings: string[],
): ParsedSkillFile['draft'] {
  const { fields, body: rawBody } = parseFrontmatter(markdown);
  const body = rawBody.trim();
  if (!body) throw new ImportRejectedError('The skill body is empty');
  if (body.length > SKILL_LIMITS.body) {
    throw new ImportRejectedError(`The skill body is longer than ${SKILL_LIMITS.body} characters`, {
      length: body.length,
    });
  }

  const str = (k: string): string | undefined => {
    const v = fields[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };

  if (fields['allowed-tools'] !== undefined) {
    ignored.push({
      path: `${skillPath}#allowed-tools`,
      reason: 'allowed-tools is ignored: a skill is text only and cannot call tools',
    });
    warnings.push('Frontmatter "allowed-tools" was ignored — skills cannot call tools.');
  }
  const unknown = Object.keys(fields).filter((k) => !KNOWN_KEYS.has(k));
  if (unknown.length) warnings.push(`Unknown frontmatter keys ignored: ${unknown.join(', ')}.`);

  // name
  const fmName = str('name');
  let name = fmName && SKILL_NAME_RE.test(fmName) && fmName.length <= SKILL_LIMITS.name ? fmName : '';
  if (!name) {
    name = toKebab(fmName ?? fallbackName) || FALLBACK_NAME;
    warnings.push(
      fmName
        ? `Name "${fmName}" is not kebab-case — renamed to "${name}".`
        : `No name in frontmatter — derived "${name}" from the file name.`,
    );
  }

  // description
  let description = str('description');
  if (!description) {
    description = firstParagraph(body) || `Imported skill ${name}`;
    warnings.push('No description in frontmatter — used the first paragraph. Rewrite it as a directive.');
  }
  if (description.length > SKILL_LIMITS.description) {
    description = description.slice(0, SKILL_LIMITS.description - 1).trimEnd() + '…';
    warnings.push(`Description was cut to ${SKILL_LIMITS.description} characters.`);
  }

  // type
  const fmType = str('type');
  const parsedType = SkillType.safeParse(fmType);
  const type = parsedType.success ? parsedType.data : DEFAULT_TYPE;
  if (!parsedType.success) {
    warnings.push(
      fmType ? `Unknown type "${fmType}" — set to "${DEFAULT_TYPE}".` : `No type in frontmatter — set to "${DEFAULT_TYPE}".`,
    );
  }

  return { name, description, type, body };
}

// ---- zip ------------------------------------------------------------------

/** `..` segments, absolute / drive / UNC paths and NUL bytes reject the archive. */
export function isUnsafePath(path: string): boolean {
  if (path.includes('\0')) return true;
  const p = path.replace(/\\/g, '/');
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return true;
  return p.split('/').some((seg) => seg === '..');
}

function ignoreReason(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.startsWith('__macosx/') || baseName(lower) === '.ds_store') return 'OS metadata';
  if (lower.split('/').slice(0, -1).includes('scripts')) return 'scripts are never run or stored';
  if (EXECUTABLE_EXT.test(lower)) return 'executable code is never run or stored';
  return 'not used: only SKILL.md becomes the skill';
}

const decoder = new TextDecoder('utf-8', { fatal: true });
function decodeUtf8(bytes: Uint8Array, path: string): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new ImportRejectedError(`${path} is not valid UTF-8 text`);
  }
}

function parseZip(filename: string, bytes: Uint8Array): ParsedSkillFile {
  if (bytes.length > IMPORT_LIMITS.zipBytes) {
    throw new ImportRejectedError(`Archive is larger than ${IMPORT_LIMITS.zipBytes / 1024 / 1024} MB`);
  }

  // Pass 1 — read the central directory only (filter returns false: nothing is inflated).
  const entries: { name: string; size: number }[] = [];
  try {
    unzipSync(bytes, {
      filter: (f) => {
        entries.push({ name: f.name, size: f.originalSize });
        return false;
      },
    });
  } catch (err) {
    throw new ImportRejectedError('Not a valid zip archive', { reason: (err as Error).message });
  }

  if (entries.length > IMPORT_LIMITS.zipEntries) {
    throw new ImportRejectedError(`Archive has more than ${IMPORT_LIMITS.zipEntries} entries`);
  }
  const unsafe = entries.filter((e) => isUnsafePath(e.name)).map((e) => e.name);
  if (unsafe.length) throw new ImportRejectedError('Archive contains unsafe paths', { paths: unsafe });
  const unpacked = entries.reduce((sum, e) => sum + e.size, 0);
  if (unpacked > IMPORT_LIMITS.unpackedBytes) {
    throw new ImportRejectedError(`Archive unpacks to more than ${IMPORT_LIMITS.unpackedBytes / 1024 / 1024} MB`);
  }

  const files = entries.filter((e) => !e.name.endsWith('/'));
  const meaningful = files.filter((e) => !e.name.startsWith('__MACOSX/'));
  const tops = new Set(meaningful.map((e) => (e.name.includes('/') ? e.name.split('/')[0]! : '')));
  const prefix = tops.size === 1 && !tops.has('') ? `${[...tops][0]}/` : '';

  const skillEntry =
    files.find((e) => e.name.toLowerCase() === SKILL_FILE) ??
    (prefix ? files.find((e) => e.name.toLowerCase() === `${prefix.toLowerCase()}${SKILL_FILE}`) : undefined);
  if (!skillEntry) {
    throw new ImportRejectedError('SKILL.md not found at the archive root or in a single top folder');
  }
  if (skillEntry.size > IMPORT_LIMITS.fileBytes) {
    throw new ImportRejectedError(`SKILL.md is larger than ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB`);
  }

  // Pass 2 — inflate SKILL.md only. fflate sizes the output buffer from the
  // declared size, so a lying header cannot make it allocate more.
  let content: Uint8Array | undefined;
  try {
    content = unzipSync(bytes, { filter: (f) => f.name === skillEntry.name })[skillEntry.name];
  } catch (err) {
    throw new ImportRejectedError('Could not read SKILL.md from the archive', { reason: (err as Error).message });
  }
  if (!content || content.length > IMPORT_LIMITS.fileBytes) {
    throw new ImportRejectedError('Could not read SKILL.md from the archive');
  }

  const sourceFiles: string[] = [];
  const ignoredFiles: ParsedSkillFile['ignoredFiles'] = [];
  for (const e of files) {
    if (e === skillEntry) continue;
    const rel = prefix && e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name;
    if (/\.md$/i.test(rel) && !rel.toLowerCase().startsWith('__macosx/') && ignoreReason(rel).startsWith('not used')) {
      sourceFiles.push(e.name);
    } else {
      ignoredFiles.push({ path: e.name, reason: ignoreReason(rel) });
    }
  }

  const warnings: string[] = [];
  if (sourceFiles.length) {
    warnings.push(`${sourceFiles.length} other markdown file(s) are listed but not merged into the body.`);
  }
  const fallbackName = prefix ? prefix.slice(0, -1) : stripExt(baseName(filename));
  const draft = buildDraft(decodeUtf8(content, skillEntry.name), fallbackName, skillEntry.name, ignoredFiles, warnings);
  return { draft, sourceFiles, ignoredFiles, warnings };
}

// ---- entry point ----------------------------------------------------------

export function parseSkillFile(filename: string, bytes: Uint8Array): ParsedSkillFile {
  const file = baseName(filename.replace(/\\/g, '/'));
  if (/\.zip$/i.test(file)) return parseZip(file, bytes);
  if (/\.(md|markdown)$/i.test(file)) {
    if (bytes.length > IMPORT_LIMITS.fileBytes) {
      throw new ImportRejectedError(`File is larger than ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB`);
    }
    const ignoredFiles: ParsedSkillFile['ignoredFiles'] = [];
    const warnings: string[] = [];
    const draft = buildDraft(decodeUtf8(bytes, file), stripExt(file), file, ignoredFiles, warnings);
    return { draft, sourceFiles: [], ignoredFiles, warnings };
  }
  throw new ImportRejectedError('Unsupported file type: upload a .md or .zip file');
}

export class FflateSkillFileParser implements SkillFileParser {
  parse(filename: string, bytes: Uint8Array): ParsedSkillFile {
    return parseSkillFile(filename, bytes);
  }
}
