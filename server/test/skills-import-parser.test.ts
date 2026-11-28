import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { SkillInput } from '@devdigest/shared';
import {
  IMPORT_LIMITS,
  isUnsafePath,
  parseFrontmatter,
  parseSkillFile,
  toKebab,
} from '../src/modules/skills/infrastructure/import-parser.js';

const md = (s: string) => strToU8(s);

const SKILL_MD = `---
name: branch-coverage-gate
description: "Flag every new branch without a test."
type: rubric
allowed-tools: [Bash, Read]
---
# Branch coverage

Check each new if/else has a test.
`;

describe('parseFrontmatter', () => {
  it('reads scalars, quotes, block scalars and lists', () => {
    const fm = parseFrontmatter(
      `---\nname: 'x'\ndescription: >\n  line one\n  line two\ntools:\n  - Bash\n  - Read\n---\nBody`,
    );
    expect(fm.fields).toEqual({ name: 'x', description: 'line one line two', tools: ['Bash', 'Read'] });
    expect(fm.body).toBe('Body');
  });

  it('returns the whole text as body without frontmatter', () => {
    expect(parseFrontmatter('# Title\n\nText')).toEqual({ fields: {}, body: '# Title\n\nText' });
  });
});

describe('parseSkillFile — .md', () => {
  it('takes name/description/type from frontmatter; allowed-tools is ignored with a warning', () => {
    const r = parseSkillFile('gate.md', md(SKILL_MD));
    expect(r.draft).toEqual({
      name: 'branch-coverage-gate',
      description: 'Flag every new branch without a test.',
      type: 'rubric',
      body: '# Branch coverage\n\nCheck each new if/else has a test.',
    });
    expect(SkillInput.safeParse(r.draft).success).toBe(true);
    expect(r.ignoredFiles).toEqual([{ path: 'gate.md#allowed-tools', reason: expect.stringMatching(/tools/) }]);
    expect(r.warnings.some((w) => w.includes('allowed-tools'))).toBe(true);
  });

  it('derives name from the file name and description from the first paragraph', () => {
    const r = parseSkillFile('My Corner Cases.md', md('# Heading\n\nLook for empty arrays.\nAnd nulls.\n\nMore.'));
    expect(r.draft.name).toBe('my-corner-cases');
    expect(r.draft.description).toBe('Look for empty arrays. And nulls.');
    expect(r.draft.type).toBe('custom');
    expect(r.warnings.join(' ')).toMatch(/description/i);
    expect(SkillInput.safeParse(r.draft).success).toBe(true);
  });

  it('rejects an empty body, an oversize file and unknown extensions', () => {
    expect(() => parseSkillFile('a.md', md('---\nname: a\n---\n  '))).toThrow(/empty/);
    expect(() => parseSkillFile('a.md', new Uint8Array(IMPORT_LIMITS.fileBytes + 1))).toThrow(/larger/);
    expect(() => parseSkillFile('a.sh', md('echo hi'))).toThrow(/Unsupported/);
  });
});

describe('parseSkillFile — .zip', () => {
  it('uses SKILL.md under a single top folder; lists other .md; ignores scripts and code', () => {
    const zip = zipSync({
      'my-skill/SKILL.md': md(SKILL_MD),
      'my-skill/reference.md': md('# ref'),
      'my-skill/scripts/run.sh': md('rm -rf /'),
      'my-skill/helper.py': md('print(1)'),
      'my-skill/logo.png': new Uint8Array([1, 2, 3]),
    });
    const r = parseSkillFile('my-skill.zip', zip);
    expect(r.draft.name).toBe('branch-coverage-gate');
    expect(r.sourceFiles).toEqual(['my-skill/reference.md']);
    const byPath = Object.fromEntries(r.ignoredFiles.map((f) => [f.path, f.reason]));
    expect(byPath['my-skill/scripts/run.sh']).toMatch(/scripts/);
    expect(byPath['my-skill/helper.py']).toMatch(/executable/);
    expect(byPath['my-skill/logo.png']).toMatch(/only SKILL\.md/);
    expect(byPath['my-skill/SKILL.md#allowed-tools']).toBeDefined();
  });

  it('uses the top folder as the fallback name', () => {
    const zip = zipSync({ 'Cool Skill/SKILL.md': md('Do the thing.') });
    expect(parseSkillFile('upload.zip', zip).draft.name).toBe('cool-skill');
  });

  it('rejects archives without SKILL.md', () => {
    expect(() => parseSkillFile('x.zip', zipSync({ 'README.md': md('x') }))).toThrow(/SKILL\.md not found/);
  });

  it('rejects path traversal and absolute paths', () => {
    expect(isUnsafePath('../evil.md')).toBe(true);
    expect(isUnsafePath('a/../../b')).toBe(true);
    expect(isUnsafePath('/etc/passwd')).toBe(true);
    expect(isUnsafePath('C:\\x')).toBe(true);
    expect(isUnsafePath('a\\..\\b')).toBe(true);
    expect(isUnsafePath('skill/SKILL.md')).toBe(false);
    const zip = zipSync({ 'SKILL.md': md('ok'), '../evil.md': md('x') });
    expect(() => parseSkillFile('x.zip', zip)).toThrow(/unsafe/);
  });

  it('rejects a zip bomb (declared unpacked size over the limit)', () => {
    const big = new Uint8Array(IMPORT_LIMITS.unpackedBytes + 1); // zeros compress to almost nothing
    const zip = zipSync({ 'SKILL.md': md('ok'), 'pad.bin': big }, { level: 9 });
    expect(zip.length).toBeLessThan(IMPORT_LIMITS.zipBytes);
    expect(() => parseSkillFile('x.zip', zip)).toThrow(/unpacks/);
  });

  it('rejects too many entries and oversize archives', () => {
    const files: Record<string, Uint8Array> = { 'SKILL.md': md('ok') };
    for (let i = 0; i < IMPORT_LIMITS.zipEntries; i++) files[`f${i}.txt`] = md('x');
    expect(() => parseSkillFile('x.zip', zipSync(files))).toThrow(/entries/);
    expect(() => parseSkillFile('x.zip', new Uint8Array(IMPORT_LIMITS.zipBytes + 1))).toThrow(/larger/);
  });

  it('rejects garbage that is not a zip', () => {
    expect(() => parseSkillFile('x.zip', md('not a zip at all, definitely not'))).toThrow(/valid zip/);
  });
});

describe('real import fixtures (docs/skills-import)', () => {
  const fixture = (name: string) =>
    new Uint8Array(readFileSync(fileURLToPath(new URL(`../../docs/skills-import/${name}`, import.meta.url))));

  it('zip built with the zip CLI: directory entries are skipped, SKILL.md found under the top folder', () => {
    const r = parseSkillFile('openapi-breaking-change.zip', fixture('openapi-breaking-change.zip'));
    expect(SkillInput.safeParse(r.draft).success).toBe(true);
    expect(r.draft.body.length).toBeGreaterThan(0);
    expect(r.sourceFiles).toEqual(['openapi-breaking-change/references/examples.md']);
    const paths = r.ignoredFiles.map((f) => f.path);
    expect(paths).toContain('openapi-breaking-change/scripts/check.sh');
    expect(paths.some((p) => p.endsWith('/'))).toBe(false);
  });

  it('the .md fixture parses into a valid draft', () => {
    const r = parseSkillFile('flaky-test-detector.md', fixture('flaky-test-detector.md'));
    expect(SkillInput.safeParse(r.draft).success).toBe(true);
  });
});

describe('toKebab', () => {
  it('normalises to the SkillInput name shape', () => {
    expect(toKebab('  Hello World_v2!! ')).toBe('hello-world-v2');
    expect(toKebab('x'.repeat(100))).toHaveLength(64);
  });
});
