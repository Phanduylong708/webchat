import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import MessageActionsMenu from "../../../../components/chat/MessageActionsMenu";

function makeMessage(overrides: Partial<DisplayMessage> & { id: number; conversationId: number }): DisplayMessage {
  const base: DisplayMessage = {
    id: 0,
    conversationId: 0,
    senderId: 1,
    content: "hi",
    messageType: "TEXT",
    createdAt: "2026-02-27T09:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
  };
  return { ...base, ...overrides } as DisplayMessage;
}

afterEach(() => cleanup());

describe("MessageActionsMenu", () => {
  it("does not render actions when onEdit is not provided", () => {
    render(
      <MessageActionsMenu message={makeMessage({ id: 1, conversationId: 1 })} enabled={true}>
        <div>child</div>
      </MessageActionsMenu>
    );

    expect(screen.queryByLabelText("Message actions")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("child")).not.toBeNull();
  });

  it("clears long-press timer on unmount", () => {
    vi.useFakeTimers();

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { unmount } = render(
      <MessageActionsMenu
        message={makeMessage({ id: 1, conversationId: 1 })}
        enabled={true}
        onEdit={() => {}}
      >
        <div>child</div>
      </MessageActionsMenu>
    );

    // Bubble pointer event should start long-press timer (event bubbles).
    fireEvent.pointerDown(screen.getByText("child"), { pointerType: "touch" });

    unmount();
    vi.runAllTimers();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
