import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL } from "@/test/fixtures/skills";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));
import { StatsTab } from "./StatsTab";

afterEach(cleanup);
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  push.mockReset();
});

const card = (label: string) => screen.getByRole("group", { name: label });

describe("StatsTab", () => {
  it("shows dashes and empty states before any run used the skill", async () => {
    api.get.mockResolvedValue({
      agents_count: 0,
      pull_rate: null,
      accept_rate: null,
      findings_30d: 0,
      agents: [],
      by_category: [],
    });
    renderWithProviders(<StatsTab skillId={SKILL.id} />);

    expect(await screen.findByText("0 agents")).toBeInTheDocument();
    expect(card("Pull frequency")).toHaveTextContent("—");
    expect(card("Accept rate")).toHaveTextContent("—");
    expect(card("Findings (30d)")).toHaveTextContent("—");
    expect(screen.getByText("No agent has this skill enabled.")).toBeInTheDocument();
    expect(screen.getByText(/No findings from runs with this skill/)).toBeInTheDocument();
    expect(screen.getByText(/Attribution is by presence/)).toBeInTheDocument();
  });

  it("shows the metrics, the agents and findings by category (counts)", async () => {
    api.get.mockResolvedValue({
      agents_count: 3,
      pull_rate: 0.714,
      accept_rate: 0.74,
      findings_30d: 96,
      agents: [{ id: "a1", name: "Security Reviewer" }],
      by_category: [
        { category: "bug", count: 40 },
        { category: "test", count: 56 },
      ],
    });
    renderWithProviders(<StatsTab skillId={SKILL.id} />);

    expect(await screen.findByText("3 agents")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(`/skills/${SKILL.id}/stats`);
    expect(card("Pull frequency")).toHaveTextContent("71%");
    expect(card("Accept rate")).toHaveTextContent("74%");
    expect(card("Findings (30d)")).toHaveTextContent("96");

    const legend = screen.getAllByTestId("donut-legend-row");
    expect(legend.map((r) => r.textContent)).toEqual(["test56", "bug40"]);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/agents/a1?tab=skills"));
  });
});
