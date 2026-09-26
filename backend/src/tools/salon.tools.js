import Salons from "../models/salonModel.js";
import Bookings from "../models/bookingModel.js";

const SALON_TZ_OFFSET = "+05:30";
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const isValidDateString = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);

export const listSalons = async () => {
  const salons = await Salons.find(
    { isActive: true },
    {
      Name: 1,
      ratingAvg: 1,
    },
  );

  return salons;
};

export const getSalonServices = async (salonName) => {
  const salon = await Salons.findOne({
    Name: salonName,
    isActive: true,
  });

  if (!salon) {
    return null;
  }

  return salon.services.filter((service) => service.isActive);
};

export const checkAvailability = async ({ salonName, serviceName, date }) => {
  if (!salonName || !serviceName || !date) {
    return {
      error:
        "salonName,serviceName and date are required to check availabality",
    };
  }

  if (!isValidDateString(date)) {
    return { error: "date must be in YYYY-MM-DD format" };
  }

  const salon = await Salons.findOne({
    Name: salonName,
    isActive: true,
  });

  const service = salon.services.find(
    (s) => s.isActive && s.name.toLowerCase() === serviceName.toLowerCase(),
  );

  if (!service) {
    return {
      error: `"${serviceName}" is not an active service at ${salonName}`,
    };
  }

  const startOfDay = new Date(`${date}T00:00:00${SALON_TZ_OFFSET}`);
  const endOfDay = new Date(`${date}T23:59:59.999${SALON_TZ_OFFSET}`);

  if (isNaN(startOfDay.getTime())) {
    return {
      error: "date must be a valid calendar date in YYYY-MM-DD format.",
    };
  }

  const bookings = await Bookings.find({
    salonId: salon._id,
    serviceId: service._id,
    slotStart: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["PENDING", "PROGRESS"] },
  });

  const bookedCounts = {};
  bookings.forEach((b) => {
    const key = b.slotStart.toISOString();
    bookedCounts[key] = (bookedCounts[key] || 0) + 1;
  });

  const availableSlots = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const iso = new Date(
        `${date}T${time}:00${SALON_TZ_OFFSET}`,
      ).toISOString();
      const booked = bookedCounts[iso] || 0;
      const available = service.maxPerSlot - booked;

      if (available > 0) {
        availableSlots.push({ time, available });
      }
    }
  }

  return {
    salon: salon.Name,
    service: service.name,
    date,
    availableSlots,
  };
};

export const getUserBookings = async (userId) => {
  const bookings = await Bookings.find({ userId })
    .populate("salonId", "Name services")
    .sort({ createdAt: -1 })
    .limit(20);

  return bookings.map((booking) => {
    const salonDoc = booking.salonId;
    const service = salonDoc?.services?.id
      ? salonDoc.services.id(booking.serviceId)
      : null;

    return {
      salon: salonDoc?.Name || "Unknown salon",
      service: service?.name || "Unknown service",
      status: booking.status,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      queueNumber: booking.queueNumber,
    };
  });
};
