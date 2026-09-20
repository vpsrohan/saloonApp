import express from "express";
import { Chat } from "../controllers/chat.controllers.js";

const router = express.Router();

router.post("/", Chat);

export default router;
