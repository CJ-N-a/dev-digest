import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

import { ImportSkillModal } from "./ImportSkillModal";

afterEach(cleanup);
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  push.mockReset();
});

const CONTENT = "---\nname: branch-coverage-gate\n---\nFlag untested branches.";
const PREVIEW = {
  draft: {
    name: "branch-coverage-gate",
    description: "When a PR adds a branch, require a test for it.",
    type: "convention",
    body: "# Branch coverage\n\nFlag untested branches.",
  },
  source_files: ["README.md"],
  ignored_files: [{ path: "scripts/check.sh", reason: "executable script" }],
  warnings: ["Description taken from the first paragraph"],
  name_conflict: false,
};

describe("ImportSkillModal", () => {
  it("previews an upload without saving, then saves the edited draft and opens it", async () => {
    api.post.mockImplementation((path: string) =>
      Promise.resolve(path === "/skills/import/preview" ? PREVIEW : { ...PREVIEW.draft, id: "sk-new", version: 1 }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ImportSkillModal onClose={onClose} />);

    const file = new File([CONTENT], "branch-coverage-gate.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [file] } });

    expect(await screen.findByText(/someone else's instructions inside your agent's prompt/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/skills/import/preview", {
      filename: "branch-coverage-gate.md",
      content_base64: Buffer.from(CONTENT).toString("base64"),
    });
    expect(screen.getByTestId("ignored-files")).toHaveTextContent("scripts/check.shexecutable script");
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Description taken from the first paragraph")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branch coverage" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "branch-gate" } });
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/skills/import", {
        ...PREVIEW.draft,
        name: "branch-gate",
        enabled: true,
        filename: "branch-coverage-gate.md",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/sk-new?tab=config"));
    expect(onClose).toHaveBeenCalled();
  });

  it("warns about a name conflict", async () => {
    api.post.mockResolvedValue({ ...PREVIEW, name_conflict: true });
    renderWithProviders(<ImportSkillModal onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File([CONTENT], "x.md")] },
    });
    expect(await screen.findByText(/already exists — rename it/)).toBeInTheDocument();
  });
});
