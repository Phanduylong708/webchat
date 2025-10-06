import { registerController } from "../controllers/auth.controller.js";
import { Router } from "express";
import { passport } from "../../shared/config/passport.config.js";
import { sendErrors, sendSuccess } from "../../shared/utils/response.util.js";
import { generateToken } from "../../shared/utils/jwt.util.js";
const authRoutes = Router();

authRoutes.post("/register", registerController);
authRoutes.post("/login", (req, res) => {
  passport.authenticate("login", { session: false }, (err, user, info) => {
    if (err) {
      return sendErrors(res, {
        statusCode: 500,
        message: "Passport authentication error",
      });
    }
    if (!user) {
      return sendErrors(res, {
        statusCode: 401,
        message: info.message || "Unauthorized",
      });
    }
    const token = generateToken({ sub: user.id });
    // If authentication is successful, return the user information
    return sendSuccess(res, {
      statusCode: 200,
      data: { user, token },
      message: "Login successful",
    });
  })(req, res);
});

authRoutes.get(
  "/me",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    // If authentication is successful, return the user information
    return sendSuccess(res, {
      statusCode: 200,
      data: { user: req.user },
      message: "User info retrieved successfully",
    });
  }
);

export { authRoutes };
