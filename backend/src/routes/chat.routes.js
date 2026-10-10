import express from "express";
import { Chat } from "../controllers/chat.controllers.js";
import { protectRoute } from "../middlewares/protectRoute.js";
import { rateLimiter } from "../utils/rateLimiter.js";
const router = express.Router();

router.post("/", rateLimiter, protectRoute, Chat);

export default router;
