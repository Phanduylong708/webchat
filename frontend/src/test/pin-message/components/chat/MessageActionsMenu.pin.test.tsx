import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DisplayMessage } from "@/types/chat.type";
import MessageActionsMenu from "@/features/chat/components/message/MessageActionsMenu";

function makeMessage(overrides: Partial<DisplayMessage> & { id: number; conversationId: number }): DisplayMessage {
  const base: DisplayMessage = {
    id: 0,
    conversationId: 0,
    senderId: 1,
    content: "hello",
    messageType: "TEXT",
    createdAt: "2026-03-10T09:00:00.000Z",
    editedAt: null,
    sender: { id: 1, username: "alice", avatar: null },
    attachments: [],
  };

  return { ...base, ...overrides } as DisplayMessage;
}

function openActionsMenu() {
  fireEvent.click(screen.getByLabelText("Message actions"));
}

afterEach(() => cleanup());

describe("MessageActionsMenu pin actions", () => {
  it("renders Pin when onPin is provided", () => {
    render(
      <MessageActionsMenu
        message={makeMessage({ id: 101, conversationId: 5 })}
        enabled={true}
        onPin={() => {}}
      >
        <div>message</div>
      </MessageActionsMenu>,
    );

    openActionsMenu();

    expect(screen.getByText("Pin")).not.toBeNull();
    expect(screen.queryByText("Unpin")).toBeNull();
  });

  it("renders Unpin when onUnpin is provided", () => {
    render(
      <MessageActionsMenu
        message={makeMessage({ id: 102, conversationId: 6 })}
        enabled={true}
        onUnpin={() => {}}
      >
        <div>message</div>
      </MessageActionsMenu>,
    );

    openActionsMenu();

    expect(screen.getByText("Unpin")).not.toBeNull();
    expect(screen.queryByText("Pin")).toBeNull();
  });

  it("calls the expected callback when pin action is clicked", () => {
    const onPin = vi.fn();

    render(
      <MessageActionsMenu
        message={makeMessage({ id: 103, conversationId: 7 })}
        enabled={true}
        onPin={onPin}
      >
        <div>message</div>
      </MessageActionsMenu>,
    );

    openActionsMenu();
    fireEvent.click(screen.getByText("Pin"));

    expect(onPin).toHaveBeenCalledTimes(1);
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ id: 103, conversationId: 7 }));
  });

  it("calls the expected callback when unpin action is clicked", () => {
    const onUnpin = vi.fn();

    render(
      <MessageActionsMenu
        message={makeMessage({ id: 104, conversationId: 8 })}
        enabled={true}
        onUnpin={onUnpin}
      >
        <div>message</div>
      </MessageActionsMenu>,
    );

    openActionsMenu();
    fireEvent.click(screen.getByText("Unpin"));

    expect(onUnpin).toHaveBeenCalledTimes(1);
    expect(onUnpin).toHaveBeenCalledWith(expect.objectContaining({ id: 104, conversationId: 8 }));
  });
});
