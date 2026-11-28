import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL } from "@/test/fixtures/skills";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), api }));

import { SkillEditor } from "../../SkillEditor";

afterEach(cleanup);
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  push.mockReset();
  replace.mockReset();
});

const body = () => screen.getByLabelText("Skill body") as HTMLTextAreaElement;

describe("Skill ConfigTab", () => {
  it("marks the body unsaved, counts tokens and sends the change note in the PATCH", async () => {
    api.patch.mockResolvedValue({ ...SKILL, body: "# Rubric v2", version: 6 });
    renderWithProviders(<SkillEditor skill={SKILL} tab="config" />);

    expect(screen.getByText("pr-quality-rubric.md")).toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(screen.getByTestId("body-tokens")).toHaveTextContent("5 tokens"); // 19 chars / 4

    fireEvent.change(body(), { target: { value: "# Rubric v2" } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByTestId("body-tokens")).toHaveTextContent("3 tokens");

    fireEvent.change(screen.getByLabelText("Change note"), { target: { value: "Added v2 heading" } });
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/skills/${SKILL.id}`, {
        body: "# Rubric v2",
        change_note: "Added v2 heading",
      }),
    );
  });

  it("validates before saving and keeps the draft visible in Preview", () => {
    const { rerender } = renderWithProviders(<SkillEditor skill={SKILL} tab="config" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Not Kebab" } });
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/lowercase letters, digits and dashes/);
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.change(body(), { target: { value: "# Draft heading" } });
    rerender(<SkillEditor skill={SKILL} tab="preview" />);
    expect(screen.getByRole("heading", { name: "Draft heading" })).toBeInTheDocument();
    expect(screen.getByText("unsaved draft")).toBeInTheDocument();
  });

  it("creates a new skill and opens it", async () => {
    api.post.mockResolvedValue({ ...SKILL, id: "new-id", version: 1 });
    renderWithProviders(<SkillEditor tab="config" />);

    expect(screen.getByRole("button", { name: /Preview/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "my-skill" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Flag X when Y." } });
    fireEvent.change(body(), { target: { value: "Do the thing." } });
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/skills", {
        name: "my-skill",
        description: "Flag X when Y.",
        type: "rubric",
        body: "Do the thing.",
        enabled: true,
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/skills/new-id?tab=config"));
  });
});
