import express from "express";
import { protectRoute } from "../middlewares/protectRoute.js";
import {
  addBooking,
  cancelBooking,
  endService,
  getAllBookings,
  startService,
  getAvailability,
  getSalonBookings,
} from "../controllers/booking.controller.js";
import { checkAdmin } from "../middlewares/checkAdmin.js";
const router = express.Router();

router.get("/availability", getAvailability);

router.get("/", protectRoute, getAllBookings);
router.get("/salon/:salonId", protectRoute, checkAdmin, getSalonBookings);
router.post("/", protectRoute, addBooking);

router.patch("/delete/:id", protectRoute, cancelBooking);

router.patch("/update/:id/start", protectRoute, checkAdmin, startService);
router.patch("/update/:id/end", protectRoute, checkAdmin, endService);

export default router;
