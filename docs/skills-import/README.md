# Skill import fixtures

Files for the M2 Import flow (`/skills` → **Add Skill ▾ → Import**). They are **not
seeded**: each one goes through Import by hand so the demo shows the preview, the
ignored files and the trust warning (see `specs/M2-skills.md`, "Import").

| File | Skill | Attach to | Shows |
|---|---|---|---|
| `flaky-test-detector.md` | `flaky-test-detector` (rubric) | **Test Quality Reviewer** | `.md` import: YAML frontmatter (`name`, `description`, `type`) + body |
| `openapi-breaking-change.zip` | `openapi-breaking-change` (rubric) | **API Contract Reviewer** | `.zip` import: only `SKILL.md` becomes the body; `references/examples.md` is listed in `source_files`; `scripts/check.sh` and the `allowed-tools` frontmatter line go to `ignored_files` |

## Steps
1. `/skills` → **Add Skill ▾ → Import** → drop the file.
2. Read the preview: draft, rendered body, ignored files, warnings.
3. **Save** → the skill is created with source `imported_url` (shown as "Imported").
4. Open the agent from the table above → **Skills** tab → attach the new skill.

## Trust note
An imported skill is someone else's instructions inside your agent's prompt. Read
the body before saving. DevDigest never executes or stores the archive's other
files: the zip is parsed in memory, only the `SKILL.md` text is kept, and
`allowed-tools` is ignored because a skill is text only — it cannot run code, call
tools or read files. `scripts/check.sh` is a harmless `echo` that exists only to
show it is ignored.

## Rebuilding the zip
The zip is built from the `openapi-breaking-change/` source folder next to it:

```sh
cd docs/skills-import
rm -f openapi-breaking-change.zip
zip -r -X openapi-breaking-change.zip openapi-breaking-change -x '*.DS_Store'
```
