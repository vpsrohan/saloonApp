import express from "express";
import { protectRoute } from "../middlewares/protectRoute.js";
import { checkAdmin } from "../middlewares/checkAdmin.js";

import {
  addSalon,
  getAllSalons,
  updateSalon,
  deleteSalon,
  getSalon,
} from "../controllers/salon.controllers.js";

const router = express.Router();

router.post("/", protectRoute, checkAdmin, addSalon);
router.get("/", getAllSalons);

router.get("/:id", getSalon);
router.patch("/:id", protectRoute, checkAdmin, updateSalon);
router.delete("/:id", protectRoute, checkAdmin, deleteSalon);
export default router;
