
import { describe, test, expect, jest, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../src/models/salonModel.js", () => {
  const Salons = jest.fn(function (data) {
    Object.assign(this, data);
    this._id = "salon-123";
    this.save = jest.fn().mockResolvedValue(undefined);
  });

  Salons.findOne = jest.fn();
  Salons.find = jest.fn();
  Salons.findById = jest.fn();

  return { default: Salons };
});

const {
  addSalon,
  getAllSalons,
  getSalon,
  updateSalon,
  deleteSalon,
} = await import("../../src/controllers/salon.controllers.js");

const { default: Salons } = await import("../../src/models/salonModel.js");

const OWNER_ID = "owner-123";

const makeReq = (body = {}, params = {}, user = { _id: OWNER_ID }) => ({
  body,
  params,
  user,
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeSalon = (overrides = {}) => ({
  _id: "salon-123",
  Name: "Test Salon",
  isActive: true,
  ownerId: OWNER_ID,
  ratingAvg: 4.5,
  ratingCnt: 10,
  services: [
    { _id: "service-1", name: "Haircut", isActive: true },
    { _id: "service-2", name: "Facial", isActive: false },
  ],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("addSalon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Salons.findOne.mockResolvedValue(null);
  });

  test("rejects missing salon details", async () => {
    const req = makeReq({ Name: "Test Salon" });
    const res = makeRes();

    await addSalon(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please enter all details required",
    });
  });

  test("rejects a duplicate salon", async () => {
    Salons.findOne.mockResolvedValue(makeSalon());

    const req = makeReq({
      Name: "Test Salon",
      services: [{ name: "Haircut" }],
    });
    const res = makeRes();

    await addSalon(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Salon already exists",
    });
  });

  test("creates a salon for the current owner", async () => {
    const req = makeReq({
      Name: "New Salon",
      services: [{ name: "Haircut" }],
    });
    const res = makeRes();

    await addSalon(req, res);

    expect(Salons.findOne).toHaveBeenCalledWith({ Name: "New Salon" });
    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.newSalon.Name).toBe("New Salon");
    expect(response.newSalon.ownerId).toBe(OWNER_ID);
  });
});

describe("getAllSalons", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns only active salons", async () => {
    const salons = [makeSalon()];
    Salons.find.mockResolvedValue(salons);

    const res = makeRes();
    await getAllSalons(makeReq(), res);

    expect(Salons.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(salons);
  });
});

describe("getSalon", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns an active salon with only active services", async () => {
    Salons.findById.mockResolvedValue(makeSalon());

    const res = makeRes();
    await getSalon(makeReq({}, { id: "salon-123" }), res);

    expect(Salons.findById).toHaveBeenCalledWith("salon-123");
    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.services).toHaveLength(1);
    expect(response.services[0].name).toBe("Haircut");
  });

  test("rejects a missing salon", async () => {
    Salons.findById.mockResolvedValue(null);

    const res = makeRes();
    await getSalon(makeReq({}, { id: "missing" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "The salon doesnt exist",
    });
  });

  test("rejects an inactive salon", async () => {
    Salons.findById.mockResolvedValue(makeSalon({ isActive: false }));

    const res = makeRes();
    await getSalon(makeReq({}, { id: "salon-123" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("updateSalon", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rejects a missing salon", async () => {
    Salons.findById.mockResolvedValue(null);

    const res = makeRes();
    await updateSalon(
      makeReq({ Name: "Updated" }, { id: "missing" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("rejects a non-owner", async () => {
    Salons.findById.mockResolvedValue(
      makeSalon({ ownerId: "different-owner" })
    );

    const res = makeRes();
    await updateSalon(
      makeReq({ Name: "Updated" }, { id: "salon-123" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Not authorized" });
  });

  test("allows the owner to update the salon", async () => {
    const salon = makeSalon();
    Salons.findById.mockResolvedValue(salon);

    const res = makeRes();
    await updateSalon(
      makeReq({ Name: "Updated Salon", isActive: false }, { id: "salon-123" }),
      res
    );

    expect(salon.Name).toBe("Updated Salon");
    expect(salon.isActive).toBe(false);
    expect(salon.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejects services when they are not an array", async () => {
    const salon = makeSalon();
    Salons.findById.mockResolvedValue(salon);

    const res = makeRes();
    await updateSalon(
      makeReq({ services: "not-an-array" }, { id: "salon-123" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(salon.save).not.toHaveBeenCalled();
  });
});

describe("deleteSalon", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 if the salon does not exist", async () => {
    Salons.findById.mockResolvedValue(null);

    const res = makeRes();
    await deleteSalon(makeReq({}, { id: "missing" }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("rejects a non-owner", async () => {
    Salons.findById.mockResolvedValue(
      makeSalon({ ownerId: "different-owner" })
    );

    const res = makeRes();
    await deleteSalon(makeReq({}, { id: "salon-123" }), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("soft-deletes the salon for its owner", async () => {
    const salon = makeSalon();
    Salons.findById.mockResolvedValue(salon);

    const res = makeRes();
    await deleteSalon(makeReq({}, { id: "salon-123" }), res);

    expect(salon.isActive).toBe(false);
    expect(salon.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Salon deleted successfully",
    });
  });
});
