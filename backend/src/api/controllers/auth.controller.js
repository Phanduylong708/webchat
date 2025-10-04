import { register } from "../services/auth.service.js";
import { sendSuccess, sendErrors } from "../../shared/utils/response.util.js";

async function registerController(req, res, next) {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Email, password, and username are required",
      });
    }
    if (password.length < 6) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Password must be at least 6 characters long",
      });
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return sendErrors(res, {
        statusCode: 400,
        message: "Invalid email format",
      });
    }
    const newUser = await register(email, password, username);
    return sendSuccess(res, {
      statusCode: 201,
      data: newUser,
      message: "User registered successfully",
    });
  } catch (error) {
    next(error);
  }
}

export { registerController };
