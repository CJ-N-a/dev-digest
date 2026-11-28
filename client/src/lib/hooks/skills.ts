/* hooks/skills.ts — React Query hooks for the M2 Skills screen (/skills). */
"use client";

import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ImportPreview,
  Skill,
  SkillInput,
  SkillListItem,
  SkillPatch,
  SkillStats,
  SkillVersion,
  SkillVersionFull,
} from "@devdigest/shared";

/** Query keys for the skills domain (kept here, never in components). */
export const skillKeys = {
  list: () => ["skills"] as const,
  detail: (id: string) => ["skill", id] as const,
  stats: (id: string) => ["skill-stats", id] as const,
  versions: (id: string) => ["skill-versions", id] as const,
  version: (id: string, v: number) => ["skill-versions", id, v] as const,
};

/** Refresh everything a content save / restore can change. */
function invalidateSkill(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: skillKeys.list() });
  qc.invalidateQueries({ queryKey: skillKeys.detail(id) });
  qc.invalidateQueries({ queryKey: skillKeys.versions(id) });
}

export function useSkills() {
  return useQuery({
    queryKey: skillKeys.list(),
    queryFn: () => api.get<SkillListItem[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.detail(id ?? ""),
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: skillKeys.list() });
      qc.setQueryData(skillKeys.detail(data.id), data);
    },
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: SkillPatch;
}

type UpdateCtx = { prevList?: SkillListItem[]; prevSkill?: Skill };

/** PATCH /skills/:id — optimistic (the card's enabled toggle), rolled back on error. */
export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation<Skill, Error, UpdateSkillInput, UpdateCtx>({
    mutationFn: ({ id, patch }) => api.patch<Skill>(`/skills/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      const { change_note: _note, ...fields } = patch;
      await qc.cancelQueries({ queryKey: skillKeys.list() });
      await qc.cancelQueries({ queryKey: skillKeys.detail(id) });
      const prevList = qc.getQueryData<SkillListItem[]>(skillKeys.list());
      const prevSkill = qc.getQueryData<Skill>(skillKeys.detail(id));
      if (prevList) {
        qc.setQueryData<SkillListItem[]>(
          skillKeys.list(),
          prevList.map((s) => (s.id === id ? { ...s, ...fields } : s)),
        );
      }
      if (prevSkill) qc.setQueryData<Skill>(skillKeys.detail(id), { ...prevSkill, ...fields });
      return { prevList, prevSkill };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prevList) qc.setQueryData(skillKeys.list(), ctx.prevList);
      if (ctx?.prevSkill) qc.setQueryData(skillKeys.detail(id), ctx.prevSkill);
    },
    onSuccess: (data) => qc.setQueryData(skillKeys.detail(data.id), data),
    onSettled: (_d, _e, { id }) => invalidateSkill(qc, id),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: skillKeys.list() });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.removeQueries({ queryKey: skillKeys.detail(id) });
    },
  });
}

export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.stats(id ?? ""),
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKeys.versions(id ?? ""),
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useSkillVersion(id: string | null | undefined, version: number | null | undefined) {
  return useQuery({
    queryKey: skillKeys.version(id ?? "", version ?? 0),
    queryFn: () => api.get<SkillVersionFull>(`/skills/${id}/versions/${version}`),
    enabled: !!id && version != null,
  });
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.setQueryData(skillKeys.detail(data.id), data);
      invalidateSkill(qc, data.id);
    },
  });
}

/** Read a File as base64 (no `data:` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Body of POST /skills/import/preview. The one place that decides the wire
 * format — switch to multipart `FormData` here if the server registers it.
 */
export async function buildImportPreviewBody(file: File): Promise<{ filename: string; content_base64: string }> {
  return { filename: file.name, content_base64: await fileToBase64(file) };
}

/** Parse an uploaded .md / .zip into a draft. Writes nothing on the server. */
export function useImportPreview() {
  return useMutation({
    mutationFn: async (file: File) =>
      api.post<ImportPreview>("/skills/import/preview", await buildImportPreviewBody(file)),
  });
}

/** Save the confirmed draft; `filename` makes the v1 note "Imported from <file>". */
export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, filename }: { draft: SkillInput; filename?: string }) =>
      api.post<Skill>("/skills/import", { ...draft, filename }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: skillKeys.list() });
      qc.setQueryData(skillKeys.detail(data.id), data);
    },
  });
}
