/**
 * Tests for GroupMembersDialog — optimistic remove cache patch.
 *
 * The rendering/loading tests are intentionally omitted (low value — just
 * React rendering of mock data). This file covers the only meaningful logic
 * in the component: the queryClient.setQueryData patch after remove succeeds.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationsDetail } from "@/types/chat.type";
import { queryClient } from "@/lib/queryClient";
import { conversationDetailsQueryKey } from "@/hooks/queries/conversations";
import GroupMembersDialog from "../../../components/chat/GroupMembersDialog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/context/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, username: "alice", avatar: null } }),
}));

const mockRemoveMemberMutateAsync = vi.fn();

vi.mock("@/hooks/queries/conversations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/queries/conversations")>();
  return {
    ...actual,
    useLeaveGroupMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemoveMemberMutation: () => ({ mutateAsync: mockRemoveMemberMutateAsync }),
  };
});

vi.mock("../../../components/chat/AddMemberDialog", () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE = { id: 1, username: "alice", avatar: null };
const BOB = { id: 2, username: "bob", avatar: null };
const CAROL = { id: 3, username: "carol", avatar: null };

const baseDetails: ConversationsDetail = {
  id: 42,
  title: "Test Group",
  type: "GROUP",
  members: [ALICE, BOB, CAROL],
  creatorId: 1,
  pinSummary: null,
  pinPermission: "ALL_MEMBERS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <GroupMembersDialog conversationId={42} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /group members/i }));
  await act(async () => {});
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  queryClient.clear();
  cleanup();
  mockRemoveMemberMutateAsync.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GroupMembersDialog — optimistic remove", () => {
  it("patches details cache to remove member immediately after mutation succeeds", async () => {
    mockRemoveMemberMutateAsync.mockResolvedValueOnce(undefined);
    queryClient.setQueryData(conversationDetailsQueryKey(42), baseDetails);

    renderDialog();
    await openDialog();

    const removeButtons = screen.getAllByRole("button", { name: /^remove$/i });
    expect(removeButtons.length).toBeGreaterThan(0);

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockRemoveMemberMutateAsync).toHaveBeenCalled();
    });

    const details = queryClient.getQueryData<ConversationsDetail>(conversationDetailsQueryKey(42));
    expect(details?.members.length).toBeLessThan(baseDetails.members.length);
  });
});
