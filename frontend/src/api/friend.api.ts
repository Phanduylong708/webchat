import { api } from "@/lib/axios.config";
import type { Friend, } from "@/types/friend.type";


async function getFriends(): Promise<Friend[]> {
    try {
        const response: { success: boolean, data: { friends: Friend[] } }  = await api.get("/friends");
        return response.data.friends;
    } catch (error) {
    const caughtError = error as {
      response?: { data?: { message?: string }; status?: number };
    };
    if (caughtError.response?.data?.message) {
      throw {
        message: caughtError.response.data.message,
        code: "BACKEND_ERROR",
        status: caughtError.response.status || 400,
      };
    }
    else if (!caughtError.response) {
      throw {
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        status: 503,
      };
    }
    else {
      throw {
        message: "An unexpected error occurred. Please try again later.",
        code: "UNKNOWN_ERROR",
        status: caughtError.response.status || 500,
      };
    }
  }
}

async function addFriendById(friendId: number): Promise<Friend> {
    try {
        const response: { success: boolean, data: { friend: Friend } }  = await api.post("/friends/",  { friendId });
        return response.data.friend;
    } catch (error) {
        const caughtError = error as {
            response?: { data?: { message?: string }; status?: number };
        };
        if (caughtError.response?.data?.message) {
            throw {
                message: caughtError.response.data.message,
                code: "BACKEND_ERROR",
                status: caughtError.response.status || 400,
            };
        }
        else if (!caughtError.response) {
            throw {
                message: "Network error. Please check your connection.",
                code: "NETWORK_ERROR",
                status: 503,
            };
        }
        else {
            throw {
                message: "An unexpected error occurred. Please try again later.",
                code: "UNKNOWN_ERROR",
                status: caughtError.response.status || 500,
            };
        }
    }
}

async function removeFriendById(friendId: number): Promise<void> {
    try {
      await api.delete(`/friends/${friendId}`);
    } catch (error) {
      const caughtError = error as {
        response?: { data?: { message?: string }; status?: number };
      };
      if (caughtError.response?.data?.message) {
        throw {
          message: caughtError.response.data.message,
          code: "BACKEND_ERROR",
          status: caughtError.response.status || 400,
        };
      }
      else if (!caughtError.response) {
        throw {
          message: "Network error. Please check your connection.",
          code: "NETWORK_ERROR",
          status: 503,
        };
      }
      else {
        throw {
          message: "An unexpected error occurred. Please try again later.",
          code: "UNKNOWN_ERROR",
          status: caughtError.response.status || 500,
        };
      }
    }
}

async function searchUserByUsername(username: string): Promise<Friend> {
  try {
    const response: { success: boolean, data: { user: Friend } }  = await api.get(`/users/search?username=${encodeURIComponent(username)}`);
    return response.data.user;
  } catch (error) {
    const caughtError = error as {
      response?: { data?: { message?: string }; status?: number };
    };
    if (caughtError.response?.data?.message) {
      throw {
        message: caughtError.response.data.message,
        code: "BACKEND_ERROR",
        status: caughtError.response.status || 400,
      };
    }
    else if (!caughtError.response) {
      throw {
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        status: 503,
      };
    }
    else {
      throw {
        message: "An unexpected error occurred. Please try again later.",
        code: "UNKNOWN_ERROR",
        status: caughtError.response.status || 500,
      };
    }
  }
}

export { getFriends, addFriendById, removeFriendById, searchUserByUsername };