import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL } from "@/test/fixtures/skills";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));
import { VersionsTab } from "./VersionsTab";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

const VERSIONS = [
  { version: 5, message: "Added Tests dimension", created_at: "2026-11-20T10:00:00Z", current: true },
  { version: 4, message: "Tightened wording", created_at: "2026-11-10T10:00:00Z", current: false },
];

describe("VersionsTab", () => {
  it("badges the current version and restores an older one only after confirm", async () => {
    api.get.mockResolvedValue(VERSIONS);
    api.post.mockResolvedValue({ ...SKILL, version: 6 });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderWithProviders(<VersionsTab skill={SKILL} />);

    const rows = await screen.findAllByTestId("version-row");
    expect(screen.getByText("2 versions")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Current")).toBeInTheDocument();
    expect(within(rows[0]!).queryByText("Restore")).not.toBeInTheDocument();

    const restore = within(rows[1]!).getByRole("button", { name: /Restore/ });
    fireEvent.click(restore);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(restore);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/skills/${SKILL.id}/versions/4/restore`));
  });
});
