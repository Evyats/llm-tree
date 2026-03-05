import { describe, expect, it } from "vitest";
import { normalizeMarkdownText } from "../features/markdown/normalize";

describe("normalizeMarkdownText", () => {
  it("collapses excessive blank lines", () => {
    const input = "a\n\n\n\nb";
    expect(normalizeMarkdownText(input)).toBe("a\n\nb");
  });

  it("removes unmatched trailing markdown bold token", () => {
    const input = "What it is:** A thing";
    expect(normalizeMarkdownText(input)).toBe("What it is: A thing");
  });

  it("removes blank lines adjacent to list items", () => {
    const input = "Intro\n\n- one\n\n- two\n\nTail";
    expect(normalizeMarkdownText(input)).toBe("Intro\n- one\n- two\n\nTail");
  });
});

