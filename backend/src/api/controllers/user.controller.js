import { searchUserByUsername } from "../services/user.service.js";
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

export { searchUserController };
