import mongoose from "mongoose";
import Bookings from "../models/bookingModel.js";
import Salons from "../models/salonModel.js";
import Users from "../models/userModel.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";

const allowedTransitions = {
  PENDING: ["PROGRESS", "CANCELLED"],
  PROGRESS: ["DONE"],
  DONE: [],
  CANCELLED: [],
};

export const canTransition = (currentStatus, nextStatus) => {
  return allowedTransitions[currentStatus]?.includes(nextStatus);
};

const serializeService = (salonDoc, serviceId) => {
  const service = salonDoc?.services?.id
    ? salonDoc.services.id(serviceId)
    : null;

  return service
    ? {
        _id: service._id,
        name: service.name,
        price: service.price,
        duration: service.duration,
      }
    : null;
};

export const getAllBookings = async (req, res) => {
  try {
    const user = req.user;

    // ✅ populate salonId (has a real ref) and grab `services` too so we
    // can pull the matching service snapshot below. Previously salonId
    // was left as a raw ObjectId string and serviceId was never
    // resolvable, so the frontend's "Salon name / Service name / price"
    // fields always fell back to their placeholder text.
    const bookings = await Bookings.find({ userId: user._id })
      .populate("salonId", "Name services")
      .sort({ createdAt: -1 });

    const enriched = bookings.map((booking) => {
      const b = booking.toObject();
      const salonDoc = booking.salonId; // populated doc, or null if salon was deleted
      const service = serializeService(salonDoc, booking.serviceId);

      return {
        ...b,
        salonId: salonDoc
          ? { _id: salonDoc._id, name: salonDoc.Name }
          : b.salonId,
        serviceId: service || b.serviceId,
      };
    });

    return res.status(200).json(enriched);
  } catch (e) {
    console.log("erorr in getBookings controller", e);
    return res.status(500).json("server error");
  }
};

export const getSalonBookings = async (req, res) => {
  try {
    const { salonId } = req.params;
    const adminId = req.user._id;

    const salon = await Salons.findById(salonId);
    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    if (salon.ownerId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const bookings = await Bookings.find({ salonId })
      .populate("userId", "fullName email")
      .sort({ slotStart: 1 });

    const enriched = bookings.map((booking) => {
      const b = booking.toObject();
      const service = serializeService(salon, booking.serviceId);
      return {
        ...b,
        serviceId: service || b.serviceId,
      };
    });

    return res.status(200).json(enriched);
  } catch (e) {
    console.error("error in getSalonBooking controller", e);
    return res.status(500).json("Server error");
  }
};

export const addBooking = async (req, res) => {
  const { salonId, serviceId, slotStart } = req.body;

  const userId = req.user._id;

  const idempotencyKey = req.get("Idempotency-Key");

  if (!idempotencyKey) {
    return res.status(400).json({
      messaage: "Idempotency key is requiured",
    });
  }

  const existingBooking = await Bookings.findOne({
    idempotencyKey,
    userId,
  });

  if (existingBooking) {
    return res.status(200).json(existingBooking);
  }
  //   console.log("req.body", req.body);
  if (!salonId || !serviceId || !slotStart) {
    return res.status(400).json({
      message: "all fields not present ",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(salonId)) {
    return res.status(400).json({
      message: "salonID in incorrect format",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return res.status(400).json({
      message: "serviceId in incorrect format",
    });
  }

  const slotStartTime = new Date(slotStart);

  if (isNaN(slotStartTime.getTime())) {
    return res.status(400).json({
      message: "Invalid slotStart",
    });
  }

  const lockKey = `lock:${salonId}:${serviceId}:${slotStart}`;

  try {
    const lockToken = await acquireLock(lockKey, 10);
    if (!lockToken) {
      return res.status(409).json({
        message: "Someone else is booking the slot",
      });
    }

    try {
      const salon = await Salons.findById(salonId);
      //   console.log("All salons:", await Salons.find({}));
      //   console.log("salon id :", salonId);
      if (!salon || !salon.isActive) {
        return res.status(400).json({ message: "Salon not available" });
      }
      const service = salon.services.id(serviceId);
      if (!service || !service.isActive) {
        return res.status(400).json({ message: "Service not available" });
      }

      // const slotStartTime = new Date(slotStart);
      const slotEndTime = new Date(
        slotStartTime.getTime() + service.duration * 60 * 1000,
      );

      const overlapping = await Bookings.findOne({
        userId,
        status: "PENDING",
        slotStart: { $lt: slotEndTime },
        slotEnd: { $gt: slotStartTime },
      });
      if (overlapping) {
        return res
          .status(400)
          .json({ message: "You already have a booking in this time" });
      }

      const existingCount = await Bookings.countDocuments({
        salonId,
        serviceId,
        slotStart: slotStartTime,
        status: "PENDING",
      });

      if (existingCount >= service.maxPerSlot) {
        return res.status(400).json({ message: "Slot full" });
      }

      const newBooking = await Bookings.create({
        userId,
        salonId,
        serviceId,
        slotStart: slotStartTime,
        slotEnd: slotEndTime,
        queueNumber: existingCount + 1,
        status: "PENDING",
        idempotencyKey,
      });

      // await newBooking.save();
      // await Users.findByIdAndUpdate(userId, {
      //   activeBookingId: newBooking._id,
      // });

      return res.status(201).json(newBooking);
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  } catch (e) {
    console.error("error in addBooking", e);

    if (e.code === 11000 && e.keyPattern?.idempotencyKey) {
      const existingBooking = await Bookings.findOne({
        idempotencyKey,
        userId,
      });
      return res.status(200).json(existingBooking);
    }
    return res.status(500).json({ message: "Server error" });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const UserId = req.user._id;
    const bookingId = req.params.id;

    const booking = await Bookings.findById(bookingId);

    if (!booking) {
      return res
        .status(400)
        .json({ message: "requested booking is not present" });
    }

    if (booking.userId.toString() !== UserId.toString()) {
      return res
        .status(400)
        .json({ message: "Not authorized to delete this booking" });
    }

    if (booking.status !== "PENDING") {
      return res.status(400).json({ message: "Cannot cancel booking now" });
    }

    booking.status = "CANCELLED";
    await booking.save();

    return res.json(booking);
  } catch (e) {
    console.log("error in cancelBooking controller", e);
    res.status(500).json({ message: "server error" });
  }
};

export const startService = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const adminId = req.user._id;

    const booking = await Bookings.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!canTransition(booking.status, "PROGRESS")) {
      return res.status(400).json({
        message: "Booking cannot be started",
      });
    }

    const salon = await Salons.findById(booking.salonId);
    if (!salon || salon.ownerId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "Not your salon" });
    }

    booking.status = "PROGRESS";
    await booking.save();

    return res.status(200).json({
      message: "Service started",
      booking,
    });
  } catch (e) {
    console.error("error in startBooking", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const endService = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const adminId = req.user._id;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const booking = await Bookings.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!canTransition(booking.status, "DONE")) {
      return res.status(400).json({
        message: "Service cannot be completed",
      });
    }
    const salon = await Salons.findById(booking.salonId);
    if (!salon || salon.ownerId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "Not your salon" });
    }

    booking.status = "DONE";
    booking.slotEnd = new Date();
    await booking.save();

    return res.status(200).json({
      message: "Service completed",
      booking,
    });
  } catch (e) {
    console.error("error in completeBooking", e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAvailability = async (req, res) => {
  try {
    const { salonId, serviceId, date } = req.query;

    if (!salonId || !serviceId || !date) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    // Get start and end of the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all bookings for this salon, service, and date
    const bookings = await Bookings.find({
      salonId,
      serviceId,
      slotStart: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ["PENDING", "PROGRESS"] }, // Don't count cancelled/completed
    });

    // Count bookings per time slot
    const bookingCounts = {};

    bookings.forEach((booking) => {
      const slotKey = booking.slotStart.toISOString();
      bookingCounts[slotKey] = (bookingCounts[slotKey] || 0) + 1;
    });

    return res.status(200).json({ bookingCounts });
  } catch (e) {
    console.error("error in getAvailability controller", e);
    return res.status(500).json({ message: "Server error" });
  }
};
