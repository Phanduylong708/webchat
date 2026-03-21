/**
 * Tests for useMembershipSync — details cache (conversation-details) behavior.
 *
 * Covers the paths added during the conversation-details migration:
 * - memberAdded  → patch details cache (append member)
 * - memberLeft   → patch details cache (filter member)
 * - addedToConversation → seed details cache from payload
 * - youWereKicked → remove details cache entry
 *
 * List-cache (conversationsQueryKey) behavior is tested elsewhere;
 * these tests only assert the details cache side-effects.
 */

import { act, cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsDetail, ConversationsResponse, User } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationsQueryKey, conversationDetailsQueryKey } from "@/hooks/queries/conversations";
import { useConversationSockets } from "@/hooks/sockets/useConversationSockets";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockSocket {
  handlers = new Map<string, (...args: unknown[]) => void>();
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.handlers.set(event, handler);
  });
  off = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const existing = this.handlers.get(event);
    if (existing === handler) this.handlers.delete(event);
  });
  trigger(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
}

const mockSocket = new MockSocket();

vi.mock("@/hooks/context/useSocket", () => ({
  default: () => ({
    socket: mockSocket,
    isConnected: true,
    presenceByUserId: new Map(),
    error: null,
  }),
}));

vi.mock("@/features/auth/providers/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", avatar: null } }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE: User = { id: 1, username: "alice", avatar: null };
const BOB: User = { id: 2, username: "bob", avatar: null };
const CAROL: User = { id: 3, username: "carol", avatar: null };

function makeDetails(
  overrides: Partial<ConversationsDetail> & { id: number },
): ConversationsDetail {
  return {
    title: "Test Group",
    type: "GROUP",
    members: [ALICE, BOB],
    creatorId: 1,
    pinSummary: null,
    pinPermission: "ALL_MEMBERS",
    ...overrides,
  };
}

function makeListConversation(
  overrides: Partial<ConversationsResponse> & { id: number },
): ConversationsResponse {
  const { id, ...rest } = overrides;
  return {
    id,
    title: null,
    type: "GROUP",
    previewMembers: [BOB],
    memberCount: 2,
    lastMessage: null,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDetails(conversationId: number): ConversationsDetail | undefined {
  return queryClient.getQueryData<ConversationsDetail>(conversationDetailsQueryKey(conversationId));
}

function Harness() {
  const [, setTypingByConversation] = useState(new Map<number, Map<number, string>>());
  const [, setSystemMessages] = useState(new Map<number, string>());
  useConversationSockets({
    setTypingByConversation,
    setSystemMessages,
    clearActiveConversation: vi.fn(),
  });
  return null;
}

function mountHarness() {
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  queryClient.clear();
  cleanup();
  mockSocket.handlers.clear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMembershipSync — details cache", () => {
  describe("memberAdded", () => {
    it("appends new member to details cache", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1, members: [ALICE, BOB] }));
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberAdded", { conversationId: 1, member: CAROL });
      });

      const details = getDetails(1);
      expect(details?.members.map((m) => m.id)).toEqual([1, 2, 3]);
    });

    it("does not duplicate member already in details cache", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1, members: [ALICE, BOB] }));
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberAdded", { conversationId: 1, member: BOB });
      });

      const details = getDetails(1);
      expect(details?.members).toHaveLength(2);
    });

    it("is a no-op when details cache is not seeded", async () => {
      // details cache empty — should not crash or create a partial entry
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberAdded", { conversationId: 1, member: CAROL });
      });

      expect(getDetails(1)).toBeUndefined();
    });
  });

  describe("memberLeft", () => {
    it("removes leaving member from details cache", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1, members: [ALICE, BOB, CAROL] }));
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberLeft", { conversationId: 1, userId: BOB.id });
      });

      const details = getDetails(1);
      expect(details?.members.map((m) => m.id)).toEqual([1, 3]);
    });

    it("removes member identified via payload.user field", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1, members: [ALICE, BOB] }));
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberLeft", { conversationId: 1, user: BOB });
      });

      expect(getDetails(1)?.members.map((m) => m.id)).toEqual([1]);
    });

    it("is a no-op when details cache is not seeded", async () => {
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("memberLeft", { conversationId: 1, userId: BOB.id });
      });

      expect(getDetails(1)).toBeUndefined();
    });
  });

  describe("addedToConversation", () => {
    it("seeds details cache from GROUP payload", async () => {
      queryClient.setQueryData(conversationsQueryKey(1), []);

      mountHarness();
      await act(async () => {});

      const conv: ConversationsDetail = {
        id: 5,
        title: "New Group",
        type: "GROUP",
        members: [ALICE, BOB, CAROL],
        creatorId: 2,
        pinSummary: null,
        pinPermission: "ALL_MEMBERS",
      };

      act(() => {
        mockSocket.trigger("addedToConversation", { conversation: conv });
      });

      const details = getDetails(5);
      expect(details).toBeDefined();
      expect(details?.members).toHaveLength(3);
      expect(details?.creatorId).toBe(2);
    });

    it("does not overwrite existing details cache entry", async () => {
      const existing = makeDetails({ id: 5, members: [ALICE, BOB], creatorId: 1 });
      queryClient.setQueryData(conversationDetailsQueryKey(5), existing);
      queryClient.setQueryData(conversationsQueryKey(1), []);

      mountHarness();
      await act(async () => {});

      const conv: ConversationsDetail = {
        id: 5,
        title: "New Group",
        type: "GROUP",
        members: [ALICE, BOB, CAROL],
        creatorId: 99,
        pinSummary: null,
        pinPermission: "ALL_MEMBERS",
      };

      act(() => {
        mockSocket.trigger("addedToConversation", { conversation: conv });
      });

      // existing entry is preserved — seeding only when prev is undefined
      expect(getDetails(5)?.creatorId).toBe(1);
      expect(getDetails(5)?.members).toHaveLength(2);
    });
  });

  describe("youWereKicked", () => {
    it("removes details cache entry for the kicked conversation", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1 }));
      queryClient.setQueryData(conversationsQueryKey(1), [makeListConversation({ id: 1 })]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("youWereKicked", { conversationId: 1 });
      });

      expect(getDetails(1)).toBeUndefined();
    });

    it("does not remove details cache for other conversations", async () => {
      queryClient.setQueryData(conversationDetailsQueryKey(2), makeDetails({ id: 2 }));
      queryClient.setQueryData(conversationDetailsQueryKey(1), makeDetails({ id: 1 }));
      queryClient.setQueryData(conversationsQueryKey(1), [
        makeListConversation({ id: 1 }),
        makeListConversation({ id: 2 }),
      ]);

      mountHarness();
      await act(async () => {});

      act(() => {
        mockSocket.trigger("youWereKicked", { conversationId: 1 });
      });

      expect(getDetails(1)).toBeUndefined();
      expect(getDetails(2)).toBeDefined();
    });
  });
});
