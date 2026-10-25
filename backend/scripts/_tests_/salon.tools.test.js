import { describe, test, expect, jest, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../src/models/salonModel.js", () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/models/bookingModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

const {
  listSalons,
  getSalonServices,
  checkAvailability,
  getUserBookings,
  findAvailableServices,
} = await import("../../src/tools/salon.tools.js");

const { default: Salons } = await import("../../src/models/salonModel.js");
const { default: Bookings } = await import("../../src/models/bookingModel.js");

const salonId = "salon-123";
const serviceId = "service-123";

const makeSalon = (overrides = {}) => ({
  _id: salonId,
  Name: "Test Salon",
  isActive: true,
  ratingAvg: 4.5,
  services: [
    {
      _id: serviceId,
      name: "Haircut",
      isActive: true,
      maxPerSlot: 2,
    },
    {
      _id: "inactive-service",
      name: "Facial",
      isActive: false,
      maxPerSlot: 2,
    },
  ],
  ...overrides,
});

const makeBookingQuery = (bookings = []) => {
  const query = {
    populate: jest.fn(),
    sort: jest.fn(),
    limit: jest.fn(),
  };

  query.populate.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.limit.mockResolvedValue(bookings);

  Bookings.find.mockReturnValue(query);

  return query;
};

describe("listSalons", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns active salons with selected fields", async () => {
    const salons = [{ Name: "Test Salon", ratingAvg: 4.5 }];
    Salons.find.mockResolvedValue(salons);

    const result = await listSalons();

    expect(Salons.find).toHaveBeenCalledWith(
      { isActive: true },
      { Name: 1, ratingAvg: 1 },
    );
    expect(result).toEqual(salons);
  });

  test("propagates database errors", async () => {
    Salons.find.mockRejectedValue(new Error("Database unavailable"));

    await expect(listSalons()).rejects.toThrow("Database unavailable");
  });
});

describe("getSalonServices", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns only active services", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());

    const result = await getSalonServices("Test Salon");

    expect(Salons.findOne).toHaveBeenCalledWith({
      Name: "Test Salon",
      isActive: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Haircut");
  });

  test("returns null for an unknown salon", async () => {
    Salons.findOne.mockResolvedValue(null);

    await expect(getSalonServices("Missing Salon")).resolves.toBeNull();
  });
});

describe("checkAvailability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects missing arguments", async () => {
    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
    });

    expect(result.error).toContain("required");
    expect(Salons.findOne).not.toHaveBeenCalled();
  });

  test("rejects an invalid date format", async () => {
    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "20-10-2026",
    });

    expect(result.error).toContain("YYYY-MM-DD");
    expect(Salons.findOne).not.toHaveBeenCalled();
  });

  test("rejects an impossible calendar date", async () => {
    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "2026-02-30",
    });

    expect(result.error).toContain("YYYY-MM-DD");
  });

  test("returns an error for an unknown salon", async () => {
    Salons.findOne.mockResolvedValue(null);

    const result = await checkAvailability({
      salonName: "Missing Salon",
      serviceName: "Haircut",
      date: "2026-12-20",
    });

    expect(result.error).toContain("not found or is inactive");
  });

  test("rejects an inactive or unknown service", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());

    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Facial",
      date: "2026-12-20",
    });

    expect(result.error).toContain("not an active service");
  });

  test("returns future slots for an active service", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());
    Bookings.find.mockResolvedValue([]);

    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "2099-12-20",
    });

    expect(result.salon).toBe("Test Salon");
    expect(result.service).toBe("Haircut");
    expect(result.date).toBe("2099-12-20");
    expect(result.availableSlots.length).toBeGreaterThan(0);
    expect(result.availableSlots[0]).toEqual({
      time: "09:00",
      available: 2,
    });
  });

  test("removes a fully booked slot", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());

    const fullyBookedSlot = new Date("2099-12-20T09:00:00+05:30");

    Bookings.find.mockResolvedValue([
      { slotStart: fullyBookedSlot },
      { slotStart: fullyBookedSlot },
    ]);

    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "2099-12-20",
    });

    expect(result.availableSlots.some((slot) => slot.time === "09:00")).toBe(
      false,
    );
  });

  test("reduces capacity when a slot has existing bookings", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());

    Bookings.find.mockResolvedValue([
      {
        slotStart: new Date("2099-12-20T09:00:00+05:30"),
      },
    ]);

    const result = await checkAvailability({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "2099-12-20",
    });

    expect(result.availableSlots[0]).toEqual({
      time: "09:00",
      available: 1,
    });
  });
});

describe("findAvailableServices", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects an impossible date", async () => {
    const result = await findAvailableServices({
      date: "2026-02-30",
    });

    expect(result.error).toContain("valid YYYY-MM-DD");
    expect(Salons.find).not.toHaveBeenCalled();
  });

  test("returns a message when no active salons match", async () => {
    Salons.find.mockResolvedValue([]);

    const result = await findAvailableServices({
      date: "2099-12-20",
    });

    expect(result.message).toContain("No active salons");
  });

  test("filters by salon and service name", async () => {
    Salons.find.mockResolvedValue([
      makeSalon(),
      makeSalon({
        _id: "salon-456",
        Name: "Another Salon",
      }),
    ]);

    Bookings.find.mockResolvedValue([]);

    const result = await findAvailableServices({
      salonName: " test salon ",
      serviceName: " haircut ",
      date: "2099-12-20",
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].salon).toBe("Test Salon");
    expect(result.results[0].service).toBe("Haircut");
  });

  test("does not return inactive services", async () => {
    Salons.find.mockResolvedValue([makeSalon()]);
    Bookings.find.mockResolvedValue([]);

    const result = await findAvailableServices({
      date: "2099-12-20",
    });

    expect(result.results.every((item) => item.service !== "Facial")).toBe(
      true,
    );
  });

  test("reduces available capacity for existing bookings", async () => {
    Salons.find.mockResolvedValue([makeSalon()]);

    Bookings.find.mockResolvedValue([
      {
        salonId,
        serviceId,
        slotStart: new Date("2099-12-20T09:00:00+05:30"),
      },
    ]);

    const result = await findAvailableServices({
      salonName: "Test Salon",
      serviceName: "Haircut",
      date: "2099-12-20",
    });

    expect(result.results[0].availableSlots[0]).toEqual({
      time: "09:00",
      available: 1,
    });
  });

  test("does not return a fully booked slot", async () => {
    Salons.find.mockResolvedValue([makeSalon()]);

    Bookings.find.mockResolvedValue([
      {
        salonId,
        serviceId,
        slotStart: new Date("2099-12-20T09:00:00+05:30"),
      },
      {
        salonId,
        serviceId,
        slotStart: new Date("2099-12-20T09:00:00+05:30"),
      },
    ]);

    const result = await findAvailableServices({
      date: "2099-12-20",
    });

    expect(result.results[0].availableSlots[0].time).toBe("09:30");
  });
});

describe("getUserBookings", () => {
  beforeEach(() => jest.clearAllMocks());

  test("queries only the requested user's bookings and limits results", async () => {
    const booking = {
      salonId: {
        Name: "Test Salon",
        services: {
          id: jest.fn().mockReturnValue({ name: "Haircut" }),
        },
      },
      serviceId,
      status: "PENDING",
      slotStart: new Date("2099-12-20T09:00:00Z"),
      slotEnd: new Date("2099-12-20T09:30:00Z"),
      queueNumber: 1,
    };

    const query = makeBookingQuery([booking]);

    const result = await getUserBookings("user-123");

    expect(Bookings.find).toHaveBeenCalledWith({
      userId: "user-123",
    });
    expect(query.populate).toHaveBeenCalledWith("salonId", "Name services");
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(result[0].salon).toBe("Test Salon");
    expect(result[0].service).toBe("Haircut");
  });

  test("handles bookings whose salon is missing", async () => {
    makeBookingQuery([
      {
        salonId: null,
        serviceId,
        status: "CANCELLED",
        slotStart: new Date("2099-12-20T09:00:00Z"),
        slotEnd: new Date("2099-12-20T09:30:00Z"),
        queueNumber: 2,
      },
    ]);

    const result = await getUserBookings("user-123");

    expect(result[0].salon).toBe("Unknown salon");
    expect(result[0].service).toBe("Unknown service");
  });
});
