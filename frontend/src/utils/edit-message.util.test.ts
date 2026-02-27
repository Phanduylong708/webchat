import { describe, expect, it } from "vitest";

import {
  isNoopImageCaptionEdit,
  isNoopTextEdit,
  normalizeImageCaptionDraft,
  normalizeTextDraft,
} from "./edit-message.util";

describe("edit-message.util", () => {
  it("normalizeTextDraft trims only edges", () => {
    expect(normalizeTextDraft("  hello  ")).toBe("hello");
    expect(normalizeTextDraft("a  b")).toBe("a  b");
    expect(normalizeTextDraft(" a  b ")).toBe("a  b");
  });

  it("normalizeTextDraft returns empty string when draft is empty after trim", () => {
    expect(normalizeTextDraft("   ")).toBe("");
  });

  it("normalizeImageCaptionDraft maps empty after trim to null", () => {
    expect(normalizeImageCaptionDraft("   ")).toBeNull();
    expect(normalizeImageCaptionDraft("  hi  ")).toBe("hi");
  });

  it("isNoopTextEdit compares normalized values without collapsing internal whitespace", () => {
    expect(isNoopTextEdit("hello", "  hello  ")).toBe(true);
    expect(isNoopTextEdit("a  b", "a b")).toBe(false);
  });

  it("isNoopImageCaptionEdit compares normalized values", () => {
    expect(isNoopImageCaptionEdit("hi", " hi ")).toBe(true);
    expect(isNoopImageCaptionEdit(null, "   ")).toBe(true);
    expect(isNoopImageCaptionEdit(null, "x")).toBe(false);
    expect(isNoopImageCaptionEdit("x", "   ")).toBe(false);
  });
});
