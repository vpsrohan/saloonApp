import Salons from "../models/salonModel.js";
import Bookings from "../models/bookingModel.js";

const SALON_TZ_OFFSET = "+05:30";
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const isValidDateString = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

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

  if (!salon) {
    return {
      error: `Salon "${salonName}" was not found or is inactive`,
    };
  }

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

      // Skip slots that have already passed.
      if (new Date(iso) <= new Date()) {
        continue;
      }

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

const getTodayInKolkata = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

export const findAvailableServices = async ({
  salonName,
  serviceName,
  date,
} = {}) => {
  const searchDate = date || getTodayInKolkata();

  if (!isValidDateString(searchDate)) {
    return { error: "date must be a valid YYYY-MM-DD date" };
  }

  const salons = await Salons.find({ isActive: true });

  const matchingSalons = salons.filter(
    (salon) =>
      !salonName || salon.Name.toLowerCase() === salonName.trim().toLowerCase(),
  );

  if (matchingSalons.length === 0) {
    return { message: "No active salons matched your search." };
  }

  const startOfDay = new Date(`${searchDate}T00:00:00${SALON_TZ_OFFSET}`);
  const endOfDay = new Date(`${searchDate}T23:59:59.999${SALON_TZ_OFFSET}`);

  const bookings = await Bookings.find({
    salonId: { $in: matchingSalons.map((salon) => salon._id) },
    slotStart: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["PENDING", "PROGRESS"] },
  });

  const bookedCounts = {};

  for (const booking of bookings) {
    const key = [
      String(booking.salonId),
      String(booking.serviceId),
      booking.slotStart.toISOString(),
    ].join(":");

    bookedCounts[key] = (bookedCounts[key] || 0) + 1;
  }

  const results = [];
  const now = Date.now();

  for (const salon of matchingSalons) {
    for (const service of salon.services) {
      if (!service.isActive) continue;

      if (
        serviceName &&
        service.name.toLowerCase() !== serviceName.trim().toLowerCase()
      ) {
        continue;
      }

      const availableSlots = [];

      for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
        for (const minute of [0, 30]) {
          const time =
            `${String(hour).padStart(2, "0")}:` +
            `${String(minute).padStart(2, "0")}`;

          const slotStart = new Date(
            `${searchDate}T${time}:00${SALON_TZ_OFFSET}`,
          );

          if (slotStart.getTime() <= now) continue;

          const key = [
            String(salon._id),
            String(service._id),
            slotStart.toISOString(),
          ].join(":");

          const available = service.maxPerSlot - (bookedCounts[key] || 0);

          if (available > 0) {
            availableSlots.push({ time, available });
          }
        }
      }

      if (availableSlots.length > 0) {
        results.push({
          salon: salon.Name,
          service: service.name,
          date: searchDate,
          availableSlots,
        });
      }

      if (results.length >= 30) break;
    }

    if (results.length >= 30) break;
  }

  return {
    date: searchDate,
    message: results.length
      ? "These services have upcoming available slots."
      : "No upcoming available slots matched your search.",
    results,
  };
};
