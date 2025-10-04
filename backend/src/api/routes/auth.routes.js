import { registerController } from "../controllers/auth.controller.js";
import { Router } from "express";

const authRoutes = Router();

authRoutes.post("/register", registerController);

export { authRoutes };
