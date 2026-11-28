import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PromptAssembly } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/runs.json";
import { SkillsBlock } from "./SkillsBlock";

afterEach(cleanup);

const BASE: PromptAssembly = { system: "sys", skills: null, memory: null, specs: null, user: "u" };

function renderBlock(assembly: PromptAssembly) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <SkillsBlock assembly={assembly} />
    </NextIntlClientProvider>,
  );
}

describe("SkillsBlock (M2 trace)", () => {
  it("shows the token badge, the name vK list and the block on expand", () => {
    renderBlock({
      ...BASE,
      skills: "### Skill: no-secrets (security)\nFlag keys.\n\nBody",
      skills_tokens: 1234,
      skills_used: [
        { name: "no-secrets", version: 3, tokens: 10 },
        { name: "naming", version: 1, tokens: 5 },
      ],
    });
    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.getByText("+1,234 tokens")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["no-secrets v3", "naming v1"]);
    fireEvent.click(screen.getByText("Skills (dynamic)"));
    expect(screen.getByText(/### Skill: no-secrets \(security\)/)).toBeInTheDocument();
  });

  it("renders the block without badge/list for legacy traces", () => {
    renderBlock({ ...BASE, skills: "### skill" });
    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.queryByText(/tokens$/)).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders nothing when the run had no skills", () => {
    const { container } = renderBlock({ ...BASE, skills_used: null, skills_tokens: null });
    expect(container).toBeEmptyDOMElement();
  });
});
