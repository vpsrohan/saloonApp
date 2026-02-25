import express from "express";
import { protectRoute } from "../middlewares/protectRoute.js";
import { addRating, getRating } from "../controllers/rating.controllers.js";

const router = express.Router();

router.post("/", protectRoute, addRating);
router.get("/salon/:id", getRating);

export default router;
