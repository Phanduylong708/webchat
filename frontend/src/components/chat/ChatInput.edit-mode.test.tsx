import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChatInput from "./ChatInput";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/hooks/context/useSocket", () => ({
  default: () => ({ socket: null }),
}));

vi.mock("@/hooks/context/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", avatar: null } }),
}));

vi.mock("@/hooks/context/useMessage", () => ({
  useMessage: () => ({
    sendMessage: vi.fn(),
    insertOptimisticMessage: vi.fn(),
    updateOptimistic: vi.fn(),
  }),
}));

vi.mock("@/api/media.api", () => ({
  uploadMediaApi: vi.fn(),
}));

afterEach(() => cleanup());

describe("ChatInput edit mode", () => {
  it("shows edit bar, disables attachments, and enables Save only when not noop", async () => {
    const onCancelEdit = vi.fn();
    const onSaveEdit = vi.fn(async () => {});

    const AnyChatInput = ChatInput as unknown as any;
    render(
      <AnyChatInput
        conversationId={1}
        editTarget={{
          conversationId: 1,
          messageId: 10,
          messageType: "TEXT",
          initialContent: "hello",
        }}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
      />
    );

    expect(screen.getByText("Editing message")).toBeTruthy();

    const textarea = screen.getByPlaceholderText("Type your message..") as HTMLTextAreaElement;
    expect(textarea.value).toBe("hello");

    const attachBtn = screen.getByLabelText("Attach") as HTMLButtonElement;
    expect(attachBtn.disabled).toBe(true);

    const saveBtn = screen.getByLabelText("Save edit") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "hello!" } });
    expect(saveBtn.disabled).toBe(false);

    fireEvent.click(saveBtn);
    expect(onSaveEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Cancel edit"));
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
