/* hooks/agents.ts — React Query hooks for the A2 Agents tab + Agent Editor. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Agent, AgentSkillItem, ModelInfo, Provider, ReviewStrategy, SetAgentSkills } from "@devdigest/shared";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/agents"),
  });
}

export function useAgent(id: string | null | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
    enabled: !!id,
  });
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  enabled?: boolean;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => api.post<Agent>("/agents", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export interface UpdateAgentInput {
  id: string;
  patch: Partial<
    Pick<
      Agent,
      | "name"
      | "description"
      | "provider"
      | "model"
      | "system_prompt"
      | "output_schema"
      | "strategy"
      | "ci_fail_on"
      | "repo_intel"
      | "enabled"
    >
  >;
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateAgentInput) => api.put<Agent>(`/agents/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agent", data.id], data);
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/agents/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.removeQueries({ queryKey: ["agent", id] });
    },
  });
}

/** Dynamic model list for a provider (editor model picker). */
export function useProviderModels(provider: Provider | null | undefined) {
  return useQuery({
    queryKey: ["provider-models", provider],
    queryFn: () => api.get<ModelInfo[]>(`/providers/${provider}/models`),
    enabled: !!provider,
    staleTime: 5 * 60_000,
  });
}

// ---- Agent ↔ skills (M2: GET/PUT /agents/:id/skills) ----
export const agentSkillsKey = (agentId: string) => ["agent-skills", agentId] as const;

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: agentSkillsKey(agentId ?? ""),
    queryFn: () => api.get<AgentSkillItem[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/** Map the ordered UI list to the PUT body (array index = order). */
export function toSetAgentSkills(items: AgentSkillItem[]): SetAgentSkills {
  return { items: items.map((it) => ({ skill_id: it.skill.id, enabled: it.enabled })) };
}

/**
 * Replace the agent's ordered skill set. Variables are the full linked list in
 * order; the cache is updated optimistically and rolled back on error.
 */
export function useSetAgentSkills(agentId: string) {
  const qc = useQueryClient();
  const key = agentSkillsKey(agentId);
  return useMutation<AgentSkillItem[], Error, AgentSkillItem[], { prev?: AgentSkillItem[] }>({
    mutationFn: (items) => api.put<AgentSkillItem[]>(`/agents/${agentId}/skills`, toSetAgentSkills(items)),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AgentSkillItem[]>(key);
      qc.setQueryData<AgentSkillItem[]>(
        key,
        items.map((it, order) => ({ ...it, order })),
      );
      return { prev };
    },
    onError: (_e, _items, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) qc.setQueryData(key, data);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
