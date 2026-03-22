import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PinnedMessagesBanner from "@/features/chat/components/pin/PinnedMessagesBanner";
import type { PinSummary } from "@/types/chat.type";

afterEach(() => cleanup());

function makePinSummary(overrides?: Partial<PinSummary>): PinSummary {
  return {
    pinnedCount: 3,
    latestPinnedMessage: {
      id: 99,
      previewText: "Hey check out this new update...",
      messageType: "TEXT",
      pinnedAt: "2026-03-10T09:00:00.000Z",
    },
    ...overrides,
  };
}

describe("PinnedMessagesBanner", () => {
  it("is hidden when there are no pinned messages", () => {
    const { container } = render(
      <PinnedMessagesBanner pinSummary={makePinSummary({ pinnedCount: 0 })} onClick={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders singular and plural labels", () => {
    const { rerender } = render(
      <PinnedMessagesBanner pinSummary={makePinSummary({ pinnedCount: 1 })} onClick={() => {}} />
    );

    expect(screen.getByText("1 pinned message")).toBeTruthy();

    rerender(
      <PinnedMessagesBanner pinSummary={makePinSummary({ pinnedCount: 4 })} onClick={() => {}} />
    );

    expect(screen.getByText("4 pinned messages")).toBeTruthy();
  });

  it("renders fallback preview text and stays clickable", () => {
    const onClick = vi.fn();

    render(
      <PinnedMessagesBanner
        pinSummary={makePinSummary({ latestPinnedMessage: null })}
        onClick={onClick}
      />
    );

    expect(screen.getByText("Pinned message")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open pinned messages" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
