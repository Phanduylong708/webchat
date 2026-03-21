import { api } from "@/lib/axios.config";
import type { Friend } from "@/features/friends/types/friend.type";
import { handleApiError } from "@/utils/apiError.util";

async function getFriends(): Promise<Friend[]> {
  try {
    const response: { success: boolean; data: { friends: Friend[] } } = await api.get("/friends");
    return response.data.friends;
  } catch (error) {
    throw handleApiError(error);
  }
}

async function addFriendById(friendId: number): Promise<Friend> {
  try {
    const response: { success: boolean; data: { friend: Friend } } = await api.post("/friends/", {
      friendId,
    });
    return response.data.friend;
  } catch (error) {
    throw handleApiError(error);
  }
}

async function removeFriendById(friendId: number): Promise<void> {
  try {
    await api.delete(`/friends/${friendId}`);
  } catch (error) {
    throw handleApiError(error);
  }
}

async function searchUserByUsername(username: string): Promise<Friend> {
  try {
    const response: { success: boolean; data: { user: Friend } } = await api.get(
      `/users/search?username=${encodeURIComponent(username)}`,
    );
    return response.data.user;
  } catch (error) {
    throw handleApiError(error);
  }
}

export { getFriends, addFriendById, removeFriendById, searchUserByUsername };
