import express from "express";
import { Chat } from "../controllers/chat.controllers.js";
import { protectRoute } from "../middlewares/protectRoute.js";

const router = express.Router();

router.post("/", protectRoute, Chat);

export default router;
