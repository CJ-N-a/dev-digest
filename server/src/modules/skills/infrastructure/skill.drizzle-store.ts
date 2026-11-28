import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { Db, DbOrTx, Tx } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import {
  SkillNameTakenError,
  type NewSkill,
  type Skill,
  type SkillContent,
  type SkillSnapshot,
} from '../domain-model/skill.js';
import type { SkillStore, TxHandle, UnitOfWork } from '../domain-services/ports.js';

const exec = (db: Db, tx?: TxHandle): DbOrTx => (tx as unknown as Tx | undefined) ?? db;

type SkillRow = typeof t.skills.$inferSelect;
type SkillVersionRow = typeof t.skillVersions.$inferSelect;

const toDomain = (r: SkillRow): Skill => ({
  id: r.id,
  workspaceId: r.workspaceId,
  name: r.name,
  description: r.description,
  type: r.type,
  source: r.source,
  body: r.body,
  enabled: r.enabled,
  version: r.version,
  evidenceFiles: r.evidenceFiles ?? null,
  createdAt: r.createdAt,
});

const toSnapshot = (r: SkillVersionRow): SkillSnapshot => ({
  skillId: r.skillId,
  version: r.version,
  message: r.message,
  name: r.name,
  description: r.description,
  type: r.type,
  body: r.body,
  createdAt: r.createdAt,
});

/** Postgres unique_violation, raw or wrapped by Drizzle (DrizzleQueryError.cause). */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    if ((e as { code?: unknown }).code === '23505') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Escape LIKE wildcards so `?q=` is matched literally. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export class DrizzleSkillStore implements SkillStore {
  constructor(private db: Db) {}

  async list(workspaceId: string, q?: string): Promise<Skill[]> {
    const ws = eq(t.skills.workspaceId, workspaceId);
    const where = q
      ? and(ws, or(ilike(t.skills.name, likePattern(q)), ilike(t.skills.description, likePattern(q))))
      : ws;
    const rows = await this.db.select().from(t.skills).where(where).orderBy(t.skills.createdAt, t.skills.name);
    return rows.map(toDomain);
  }

  async getById(workspaceId: string, id: string, tx?: TxHandle, forUpdate = false) {
    const query = exec(this.db, tx)
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    const [row] = forUpdate ? await query.for('update') : await query;
    return row && toDomain(row);
  }

  async findByName(workspaceId: string, name: string, tx?: TxHandle) {
    const [row] = await exec(this.db, tx)
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row && toDomain(row);
  }

  async insert(skill: NewSkill, tx?: TxHandle): Promise<Skill> {
    try {
      const [row] = await exec(this.db, tx).insert(t.skills).values(skill).returning();
      return toDomain(row!);
    } catch (err) {
      if (isUniqueViolation(err)) throw new SkillNameTakenError(skill.name);
      throw err;
    }
  }

  async update(
    workspaceId: string,
    id: string,
    fields: Partial<SkillContent> & { enabled?: boolean; version?: number },
    tx?: TxHandle,
  ): Promise<Skill | undefined> {
    const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    try {
      const [row] = await exec(this.db, tx)
        .update(t.skills)
        .set(set)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();
      return row && toDomain(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new SkillNameTakenError(fields.name ?? '');
      throw err;
    }
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async insertVersion(s: Omit<SkillSnapshot, 'createdAt'>, tx?: TxHandle): Promise<void> {
    await exec(this.db, tx).insert(t.skillVersions).values({
      skillId: s.skillId,
      version: s.version,
      message: s.message,
      name: s.name,
      description: s.description,
      type: s.type,
      body: s.body,
    });
  }

  async listVersions(skillId: string): Promise<SkillSnapshot[]> {
    const rows = await this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
    return rows.map(toSnapshot);
  }

  async getVersion(skillId: string, version: number): Promise<SkillSnapshot | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row && toSnapshot(row);
  }
}

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Db) {}
  run<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn(tx as unknown as TxHandle));
  }
}
