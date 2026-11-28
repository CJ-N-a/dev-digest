import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import type { AgentSkillItem } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL_ITEM, makeSkill } from "@/test/fixtures/skills";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

import { SkillsTab } from "./SkillsTab";

afterEach(cleanup);

const A = makeSkill({ id: "aaaaaaaa-0000-4000-8000-000000000001", name: "alpha", type: "security" });
const B = makeSkill({ id: "bbbbbbbb-0000-4000-8000-000000000002", name: "bravo", type: "convention" });
const C = makeSkill({ id: "cccccccc-0000-4000-8000-000000000003", name: "charlie", type: "custom" });
const summary = SKILL_ITEM.summary;
const LINKS: AgentSkillItem[] = [
  { skill: B, order: 0, enabled: true },
  { skill: A, order: 1, enabled: false },
];

// Fake server: PUT replaces the stored links, GET returns them.
let stored: AgentSkillItem[] = LINKS;
beforeEach(() => {
  stored = LINKS;
  Object.values(api).forEach((fn) => fn.mockReset());
  api.get.mockImplementation((path: string) =>
    Promise.resolve(path === "/skills" ? [A, B, C].map((s) => ({ ...s, summary })) : stored),
  );
  api.put.mockImplementation((_p: string, body: { items: { skill_id: string; enabled: boolean }[] }) => {
    stored = body.items.map((it, order) => ({
      skill: [A, B, C].find((s) => s.id === it.skill_id)!,
      order,
      enabled: it.enabled,
    }));
    return Promise.resolve(stored);
  });
});

const names = () => screen.getAllByTestId("agent-skill-row").map((r) => within(r).getByText(/^(alpha|bravo|charlie)$/).textContent);
const row = (name: string) => screen.getAllByTestId("agent-skill-row").find((r) => within(r).queryByText(name))!;
const lastPut = () => api.put.mock.calls.at(-1)!;

describe("agent SkillsTab", () => {
  it("lists linked skills in order, then the rest; counts enabled ones", async () => {
    renderWithProviders(<SkillsTab agentId="ag1" />);
    expect(await screen.findByText("1 of 3 enabled")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/agents/ag1/skills");
    expect(names()).toEqual(["bravo", "alpha", "charlie"]);
    expect(within(row("bravo")).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(within(row("alpha")).getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
    expect(within(row("charlie")).getByRole("button", { name: "Reorder charlie" })).toBeDisabled();
  });

  it("links an unlinked skill and disables a linked one without dropping it", async () => {
    renderWithProviders(<SkillsTab agentId="ag1" />);
    await screen.findByText("1 of 3 enabled");

    fireEvent.click(within(row("charlie")).getByRole("checkbox"));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(lastPut()).toEqual([
      "/agents/ag1/skills",
      {
        items: [
          { skill_id: B.id, enabled: true },
          { skill_id: A.id, enabled: false },
          { skill_id: C.id, enabled: true },
        ],
      },
    ]);
    expect(await screen.findByText("2 of 3 enabled")).toBeInTheDocument();

    fireEvent.click(within(row("bravo")).getByRole("checkbox"));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(lastPut()[1]).toEqual({
      items: [
        { skill_id: B.id, enabled: false },
        { skill_id: A.id, enabled: false },
        { skill_id: C.id, enabled: true },
      ],
    });
  });

  it("reorders with the keyboard and by drag and drop", async () => {
    renderWithProviders(<SkillsTab agentId="ag1" />);
    await screen.findByText("1 of 3 enabled");

    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder bravo" }), { key: "ArrowDown" });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(lastPut()[1]).toEqual({
      items: [
        { skill_id: A.id, enabled: false },
        { skill_id: B.id, enabled: true },
      ],
    });
    await waitFor(() => expect(names()).toEqual(["alpha", "bravo", "charlie"]));

    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder bravo" }));
    fireEvent.dragOver(row("alpha"));
    fireEvent.drop(row("alpha"));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(lastPut()[1]).toEqual({
      items: [
        { skill_id: B.id, enabled: true },
        { skill_id: A.id, enabled: false },
      ],
    });
  });

  it("rolls back the optimistic order when the save fails", async () => {
    api.put.mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<SkillsTab agentId="ag1" />);
    await screen.findByText("1 of 3 enabled");
    fireEvent.click(within(row("charlie")).getByRole("checkbox"));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument());
    expect(within(row("charlie")).getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });
});
