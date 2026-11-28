import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ImportPreview,
  Skill,
  SkillInput,
  SkillListItem,
  SkillPatch,
  SkillStats,
  SkillVersion,
  SkillVersionFull,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { composeSkills } from './compose.js';
import {
  toSkillDto,
  toSkillListItemDto,
  toSkillStatsDto,
  toSkillVersionDto,
  toSkillVersionFullDto,
} from './dto.js';

const ListQuery = z.object({ q: z.string().max(200).optional() });

const VersionParams = z.object({
  id: z.string().uuid(),
  v: z.coerce.number().int().positive(),
});

/**
 * Import upload. @fastify/multipart is not registered on this server, so the
 * file comes as JSON: base64 content + original file name. Size limits are
 * enforced by the parser on the decoded bytes; the route body limit only has to
 * fit a 5 MB zip in base64 (≈ 6.7 MB).
 */
const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1),
});
const IMPORT_BODY_LIMIT = 7 * 1024 * 1024;

const ImportBody = SkillInput.extend({ filename: z.string().max(255).optional() });

/**
 * M2 — skills module (spec specs/M2-skills.md "API").
 *   GET    /skills                          → SkillListItem[] (?q= name/description)
 *   GET    /skills/:id                      → Skill
 *   POST   /skills                          → create (manual, v1) → 201
 *   PATCH  /skills/:id                      → SkillPatch; content change = new version
 *   DELETE /skills/:id                      → 204
 *   GET    /skills/:id/stats                → SkillStats (30 days)
 *   GET    /skills/:id/versions             → SkillVersion[] (newest first)
 *   GET    /skills/:id/versions/:v          → SkillVersionFull
 *   POST   /skills/:id/versions/:v/restore  → Skill (new version from vK)
 *   POST   /skills/import/preview           → ImportPreview (writes nothing)
 *   POST   /skills/import                   → created Skill (source imported_url) → 201
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const uc = composeSkills(app.container);

  app.get(
    '/skills',
    { schema: { querystring: ListQuery, response: { 200: z.array(SkillListItem) } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      const items = await uc.listSkills.execute(ctx, req.query.q);
      return items.map(toSkillListItemDto);
    },
  );

  app.get('/skills/:id', { schema: { params: IdParams, response: { 200: Skill } } }, async (req) => {
    const ctx = await getContext(app.container, req);
    return toSkillDto(await uc.getSkill.execute(ctx, req.params.id));
  });

  app.post('/skills', { schema: { body: SkillInput, response: { 201: Skill } } }, async (req, reply) => {
    const ctx = await getContext(app.container, req);
    const skill = await uc.createSkill.execute(ctx, req.body);
    reply.status(201);
    return toSkillDto(skill);
  });

  app.patch(
    '/skills/:id',
    { schema: { params: IdParams, body: SkillPatch, response: { 200: Skill } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      return toSkillDto(await uc.updateSkill.execute(ctx, req.params.id, req.body));
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req, reply) => {
    const ctx = await getContext(app.container, req);
    await uc.deleteSkill.execute(ctx, req.params.id);
    return reply.status(204).send();
  });

  app.get(
    '/skills/:id/stats',
    { schema: { params: IdParams, response: { 200: SkillStats } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      return toSkillStatsDto(await uc.getStats.execute(ctx, req.params.id));
    },
  );

  app.get(
    '/skills/:id/versions',
    { schema: { params: IdParams, response: { 200: z.array(SkillVersion) } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      const versions = await uc.listVersions.execute(ctx, req.params.id);
      return versions.map(toSkillVersionDto);
    },
  );

  app.get(
    '/skills/:id/versions/:v',
    { schema: { params: VersionParams, response: { 200: SkillVersionFull } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      return toSkillVersionFullDto(await uc.getVersion.execute(ctx, req.params.id, req.params.v));
    },
  );

  app.post(
    '/skills/:id/versions/:v/restore',
    { schema: { params: VersionParams, response: { 200: Skill } } },
    async (req) => {
      const ctx = await getContext(app.container, req);
      return toSkillDto(await uc.restoreVersion.execute(ctx, req.params.id, req.params.v));
    },
  );

  app.post(
    '/skills/import/preview',
    {
      bodyLimit: IMPORT_BODY_LIMIT,
      schema: { body: ImportPreviewBody, response: { 200: ImportPreview } },
    },
    async (req) => {
      const ctx = await getContext(app.container, req);
      const bytes = new Uint8Array(Buffer.from(req.body.content_base64, 'base64'));
      return uc.previewImport.execute(ctx, req.body.filename, bytes);
    },
  );

  app.post(
    '/skills/import',
    { schema: { body: ImportBody, response: { 201: Skill } } },
    async (req, reply) => {
      const ctx = await getContext(app.container, req);
      const { filename, ...input } = req.body;
      const skill = await uc.importSkill.execute(ctx, input, filename);
      reply.status(201);
      return toSkillDto(skill);
    },
  );
}
