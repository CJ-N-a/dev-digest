import { pgTable, uuid, text, integer, boolean, jsonb, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['rubric', 'convention', 'security', 'custom'] }).notNull(),
  source: text('source', {
    enum: ['manual', 'imported_url', 'extracted', 'community'],
  }).notNull(),
  body: text('body').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  evidenceFiles: jsonb('evidence_files').$type<string[]>(),
  createdAt: now(),
}, (t) => ({
  wsNameUq: uniqueIndex('skills_ws_name_uq').on(t.workspaceId, t.name),
}));

export const skillVersions = pgTable(
  'skill_versions',
  {
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    // M2 — change note + full snapshot for the Versions tab / Restore.
    // name/description/type are null for rows written before M2.
    message: text('message').notNull().default(''),
    name: text('name'),
    description: text('description'),
    type: text('type', { enum: ['rubric', 'convention', 'security', 'custom'] }),
    createdAt: now(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.version] }) }),
);
