import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { PreviewTab } from "./PreviewTab";

afterEach(cleanup);

describe("PreviewTab", () => {
  it("renders the body as markdown and labels an unsaved draft", () => {
    const { rerender } = renderWithProviders(<PreviewTab body={"# Rubric\n\n- **Tests** first"} />);
    expect(screen.getByText("Rendered as the reviewing agent receives it.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rubric" })).toBeInTheDocument();
    expect(screen.getByText("Tests").tagName).toBe("STRONG");
    expect(screen.queryByText("unsaved draft")).not.toBeInTheDocument();

    rerender(<PreviewTab body="# Draft" unsaved />);
    expect(screen.getByText("unsaved draft")).toBeInTheDocument();
  });
});
