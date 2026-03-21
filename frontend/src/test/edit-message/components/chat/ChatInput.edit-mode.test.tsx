import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChatInput from "@/features/chat/components/ChatInput";

const toastErrorMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/app/providers/useSocket", () => ({
  default: () => ({ socket: null }),
}));

vi.mock("@/features/auth/providers/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", avatar: null } }),
}));

vi.mock("@/api/media.api", () => ({
  uploadMediaApi: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

afterEach(() => {
  cleanup();
  toastErrorMock.mockClear();
});

function renderWithQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ChatInput edit mode", () => {
  it("shows edit bar, disables attachments, and enables Save only when not noop", async () => {
    const onCancelEdit = vi.fn();
    const onSaveEdit = vi.fn(async () => {});

    renderWithQueryClient(
      <ChatInput
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

  it("keeps edit mode and shows toast when save fails without socket", async () => {
    renderWithQueryClient(
      <ChatInput
        conversationId={1}
        editTarget={{
          conversationId: 1,
          messageId: 10,
          messageType: "TEXT",
          initialContent: "hello",
        }}
      />
    );

    const textarea = screen.getByPlaceholderText("Type your message..") as HTMLTextAreaElement;
    const saveBtn = screen.getByLabelText("Save edit") as HTMLButtonElement;

    fireEvent.change(textarea, { target: { value: "hello!" } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(screen.getByText("Editing message")).toBeTruthy();
    expect(textarea.value).toBe("hello!");
  });
});
