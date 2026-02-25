import Bookings from "../models/bookingModel.js";
import Salons from "../models/salonModel.js";
import Users from "../models/userModel.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";

export const getAllBookings = async (req, res) => {
  try {
    const user = req.user;

    const bookings = await Bookings.find({ userId: user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(bookings);
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

    return res.status(200).json(bookings);
  } catch (e) {
    console.error("error in getSalonBooking controller", e);
    return res.status(500).json("Server error");
  }
};

export const addBooking = async (req, res) => {
  const { salonId, serviceId, slotStart } = req.body;
  //   console.log("req.body", req.body);
  const userId = req.user._id;

  const lockKey = `lock:${salonId}:${serviceId}:${slotStart}`;

  try {
    const lock = await acquireLock(lockKey, 5);

    if (!lock) {
      return res.status(409).json({
        message: "Someone is booking this slot. Try again.",
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

      const slotStartTime = new Date(slotStart);
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
      });

      await newBooking.save();
      await Users.findByIdAndUpdate(userId, {
        activeBookingId: newBooking._id,
      });

      return res.status(201).json(newBooking);
    } finally {
      await releaseLock(lockKey);
    }
  } catch (e) {
    console.error("error in addBooking", e);
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

    await Users.findByIdAndUpdate(UserId, {
      activeBookingId: null,
    });

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

    if (booking.status !== "PENDING") {
      return res.status(400).json({ message: "Booking cannot be started" });
    }

    const salon = await Salons.findById(booking.salonId);
    if (!salon || salon.ownerId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "Not your salon" });
    }

    booking.status = "IN_PROGRESS";
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

    if (booking.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Service not in progress" });
    }

    const salon = await Salons.findById(booking.salonId);
    if (!salon || salon.ownerId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "Not your salon" });
    }

    booking.status = "COMPLETED";
    booking.completedAt = new Date();
    await booking.save();

    // Free the user
    await Users.findByIdAndUpdate(booking.userId, {
      activeBookingId: null,
    });

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
      status: { $in: ["PENDING", "IN_PROGRESS"] }, // Don't count cancelled/completed
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
