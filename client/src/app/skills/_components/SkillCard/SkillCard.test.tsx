import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { SKILL_ITEM } from "@/test/fixtures/skills";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

describe("SkillCard", () => {
  it("shows name, type, source and the stats line; toggling does not select the card", () => {
    const onToggle = vi.fn();
    const onClick = vi.fn();
    renderWithProviders(<SkillCard skill={SKILL_ITEM} onToggle={onToggle} onClick={onClick} />);

    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    const card = screen.getByTestId("skill-card");
    expect(card).toHaveTextContent("3 agents · 71% pull · 74% accept");
    expect(screen.getByText("74% accept")).toHaveStyle({ color: "var(--ok)" });

    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it("dims a disabled skill and shows dashes without stats", () => {
    renderWithProviders(
      <SkillCard
        skill={{ ...SKILL_ITEM, enabled: false, source: "imported_url", summary: { agents_count: 1, pull_rate: null, accept_rate: null } }}
      />,
    );
    const card = screen.getByTestId("skill-card");
    expect(card).toHaveStyle({ opacity: "0.55" });
    expect(card).toHaveTextContent("1 agent · — pull · — accept");
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });
});
