import { describe, test, expect, jest, beforeEach } from "@jest/globals";

// Mock database models
jest.unstable_mockModule("../../src/models/bookingModel.js", () => ({
  default: {
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/models/salonModel.js", () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule("../../src/models/userModel.js", () => ({
  default: { findById: jest.fn() },
}));

// Mock external services
jest.unstable_mockModule("../../src/utils/redisLock.js", () => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/kafka.service.js", () => ({
  publishEmailEvent: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/email.service.js", () => ({
  sendBookingConfirmation: jest.fn(),
  sendBookingCompleted: jest.fn(),
}));

// Import only after registering mocks
const { addBooking } = await import("../../src/controllers/booking.controller.js");

const { default: Bookings } = await import("../../src/models/bookingModel.js");
const { default: Salons } = await import("../../src/models/salonModel.js");
const { default: Users } = await import("../../src/models/userModel.js");
const { acquireLock, releaseLock } = await import("../../src/utils/redisLock.js");
const { publishEmailEvent } = await import("../../src/services/kafka.service.js");

const VALID_SALON_ID = "507f1f77bcf86cd799439011";
const VALID_SERVICE_ID = "507f1f77bcf86cd799439012";
const VALID_USER_ID = "507f1f77bcf86cd799439013";
const VALID_KEY = "test-idempotency-key";
const VALID_SLOT = "2026-10-20T10:00:00.000Z";

const makeRequest = (overrides = {}) => ({
  body: {
    salonId: VALID_SALON_ID,
    serviceId: VALID_SERVICE_ID,
    slotStart: VALID_SLOT,
    ...overrides.body,
  },
  user: { _id: VALID_USER_ID },
  get: jest.fn().mockReturnValue(VALID_KEY),
  ...overrides,
});

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeSalon = ({
  active = true,
  serviceActive = true,
  maxPerSlot = 3,
} = {}) => {
  const service = {
    _id: VALID_SERVICE_ID,
    name: "Haircut",
    duration: 30,
    maxPerSlot,
    isActive: serviceActive,
  };

  return {
    _id: VALID_SALON_ID,
    Name: "Test Salon",
    isActive: active,
    services: {
      id: jest.fn((id) => (String(id) === VALID_SERVICE_ID ? service : null)),
    },
  };
};

const makeBooking = () => ({
  _id: "booking-123",
  userId: VALID_USER_ID,
  salonId: VALID_SALON_ID,
  serviceId: VALID_SERVICE_ID,
  slotStart: new Date(VALID_SLOT),
  status: "PENDING",
});

describe("addBooking", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Bookings.findOne.mockResolvedValue(null);
    Bookings.countDocuments.mockResolvedValue(0);
    Bookings.create.mockResolvedValue(makeBooking());

    Salons.findById.mockResolvedValue(makeSalon());

    Users.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ email: "test@example.com" }),
    });

    acquireLock.mockResolvedValue("lock-token");
    releaseLock.mockResolvedValue(undefined);
    publishEmailEvent.mockResolvedValue(undefined);
  });

  test("rejects a request without an idempotency key", async () => {
    const req = makeRequest();
    req.get.mockReturnValue(undefined);
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("rejects missing booking fields", async () => {
    const req = makeRequest({ body: { salonId: "invalid-id" } });
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects an invalid salon ID", async () => {
    const req = makeRequest();
    req.body.salonId = "invalid-id";
    const res = makeResponse();
    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "salonID in incorrect format",
    });
  });

  test("rejects an invalid service ID", async () => {
    const req = makeRequest({ body: { serviceId: "invalid-id" } });
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("rejects an invalid slot date", async () => {
    const req = makeRequest({
      body: { slotStart: "not-a-date" },
    });
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("returns an existing booking for a repeated idempotency key", async () => {
    const existing = makeBooking();
    Bookings.findOne.mockResolvedValue(existing);

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(existing);
    expect(acquireLock).not.toHaveBeenCalled();
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("rejects when another request holds the lock", async () => {
    acquireLock.mockResolvedValue(null);

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Bookings.create).not.toHaveBeenCalled();
    expect(releaseLock).not.toHaveBeenCalled();
  });

  test("rejects an inactive salon", async () => {
    Salons.findById.mockResolvedValue(makeSalon({ active: false }));

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bookings.create).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith(expect.any(String), "lock-token");
  });

  test("rejects an inactive service", async () => {
    Salons.findById.mockResolvedValue(makeSalon({ serviceActive: false }));

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("rejects a full slot", async () => {
    Salons.findById.mockResolvedValue(makeSalon({ maxPerSlot: 2 }));
    Bookings.countDocuments.mockResolvedValue(2);

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Slot full" });
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("rejects a user with an overlapping pending booking", async () => {
    Bookings.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeBooking());

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "You already have a booking in this time",
    });
    expect(Bookings.create).not.toHaveBeenCalled();
  });

  test("creates a booking and publishes an email event", async () => {
    const booking = makeBooking();
    Bookings.create.mockResolvedValue(booking);

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(Bookings.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_USER_ID,
        salonId: VALID_SALON_ID,
        serviceId: VALID_SERVICE_ID,
        status: "PENDING",
        idempotencyKey: VALID_KEY,
        queueNumber: 1,
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(booking);
    expect(publishEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "BOOKING_CREATED",
      }),
    );
    expect(releaseLock).toHaveBeenCalledWith(expect.any(String), "lock-token");
  });

  test("still creates the booking if email event publishing fails", async () => {
    Bookings.create.mockResolvedValue(makeBooking());
    publishEmailEvent.mockRejectedValue(new Error("Kafka unavailable"));

    const req = makeRequest();
    const res = makeResponse();

    await addBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Bookings.create).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });
});
