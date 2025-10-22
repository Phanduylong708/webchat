import {
  addFriend,
  getFriends,
  removeFriend,
} from "../services/friend.service.js";
import { sendSuccess } from "../../shared/utils/response.util.js";
import { parseId } from "../../shared/utils/parse.util.js";

async function addFriendController(req, res, next) {
  try {
    const friendId = parseId(req.body.friendId, "friend ID");
    const currentUserId = req.user.id;
    const newFriend = await addFriend(currentUserId, friendId);
    return sendSuccess(res, {
      statusCode: 201,
      data: { friend: newFriend },
      message: "Friend added successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function getFriendsController(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const friends = await getFriends(currentUserId);
    return sendSuccess(res, {
      statusCode: 200,
      data: { friends: friends },
      message: "Friends retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function removeFriendController(req, res, next) {
  try {
    const friendId = parseId(req.params.friendId, "friend ID");
    const currentUserId = req.user.id;
    await removeFriend(currentUserId, friendId);
    return sendSuccess(res, {
      statusCode: 200,
      message: "Friend removed successfully",
    });
  } catch (error) {
    next(error);
  }
}

export { addFriendController, getFriendsController, removeFriendController };
