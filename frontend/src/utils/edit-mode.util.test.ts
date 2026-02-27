import { describe, expect, it } from "vitest";

import { getEditSaveState } from "./edit-mode.util";

describe("edit-mode.util getEditSaveState", () => {
  it("disables save for TEXT when draft is empty after trim", () => {
    const state = getEditSaveState({
      messageType: "TEXT",
      oldContent: "hello",
      draft: "   ",
    });
    expect(state.disabled).toBe(true);
    expect(state.reason).toBe("EMPTY");
  });

  it("disables save for TEXT when draft is a no-op", () => {
    const state = getEditSaveState({
      messageType: "TEXT",
      oldContent: "hello",
      draft: "  hello  ",
    });
    expect(state.disabled).toBe(true);
    expect(state.reason).toBe("NOOP");
  });

  it("enables save for TEXT when draft changes", () => {
    const state = getEditSaveState({
      messageType: "TEXT",
      oldContent: "hello",
      draft: "hello!",
    });
    expect(state.disabled).toBe(false);
    expect(state.reason).toBe(null);
  });

  it("disables save for IMAGE when caption already null and draft clears", () => {
    const state = getEditSaveState({
      messageType: "IMAGE",
      oldContent: null,
      draft: "   ",
    });
    expect(state.disabled).toBe(true);
    expect(state.reason).toBe("NOOP");
  });

  it("enables save for IMAGE when caption would be removed", () => {
    const state = getEditSaveState({
      messageType: "IMAGE",
      oldContent: "hi",
      draft: "   ",
    });
    expect(state.disabled).toBe(false);
    expect(state.reason).toBe(null);
  });
});
