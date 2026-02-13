import { searchUserByUsername, uploadMyAvatar } from "../services/user.service.js";
import { sendSuccess, sendErrors } from "../../shared/utils/response.util.js";

async function searchUserController(req, res, next) {
  try {
    const username = req.query.username;
    if (!username) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Username query parameter is required",
      });
    }
    const user = await searchUserByUsername(username);
    return sendSuccess(res, {
      statusCode: 200,
      data: { user: user },
      message: "User retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function uploadMyAvatarController(req, res, next) {
  try {
    if (!req.file) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Avatar file is required",
      });
    }

    const userId = req.user.id;
    const user = await uploadMyAvatar(userId, req.file.buffer);

    return sendSuccess(res, {
      statusCode: 200,
      data: { user },
      message: "Avatar uploaded successfully",
    });
  } catch (error) {
    next(error);
  }
}

export { searchUserController, uploadMyAvatarController };
