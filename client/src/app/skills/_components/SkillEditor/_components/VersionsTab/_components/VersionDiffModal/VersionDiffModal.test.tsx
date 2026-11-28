import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL } from "@/test/fixtures/skills";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));
import { VersionDiffModal } from "./VersionDiffModal";

afterEach(cleanup);
beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe("VersionDiffModal", () => {
  it("diffs the snapshot's body and changed fields against the current skill", async () => {
    api.get.mockResolvedValue({
      version: 3,
      message: "Old",
      created_at: "2026-11-01T00:00:00Z",
      current: false,
      name: "pr-rubric",
      description: SKILL.description,
      type: "rubric",
      body: "# Rubric\n\n- Docs",
    });
    const onClose = vi.fn();
    renderWithProviders(<VersionDiffModal skill={SKILL} version={3} onClose={onClose} />);

    expect(screen.getByText("v3 → current (v5)")).toBeInTheDocument();
    expect(await screen.findByText("- Docs")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(`/skills/${SKILL.id}/versions/3`);
    expect(screen.getByText("- Docs").closest("[data-kind]")).toHaveAttribute("data-kind", "del");
    expect(screen.getByText("- Tests").closest("[data-kind]")).toHaveAttribute("data-kind", "add");
    // name changed → its own section; description/type unchanged → none
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("pr-rubric").closest("[data-kind]")).toHaveAttribute("data-kind", "del");
    expect(screen.queryByText("Description")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);
    expect(onClose).toHaveBeenCalled();
  });
});
