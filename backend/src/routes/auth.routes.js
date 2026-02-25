import express from "express";
import {
  SignupController,
  LoginController,
  LogoutController,
  AuthCheckController,
} from "../controllers/auth.controllers.js";
import { protectRoute } from "../middlewares/protectRoute.js";
const router = express.Router();

router.post("/signup", SignupController);
router.post("/login", LoginController);
router.post("/logout", LogoutController);

router.get("/check", protectRoute, AuthCheckController);
export default router;
