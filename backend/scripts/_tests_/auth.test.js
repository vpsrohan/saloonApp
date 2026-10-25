import { describe, test, expect, jest, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../src/models/userModel.js", () => {
  const Users = jest.fn(function (data) {
    Object.assign(this, data);
    this._id = "user-123";
    this.save = jest.fn().mockResolvedValue(undefined);
  });

  Users.findOne = jest.fn();

  return { default: Users };
});

jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    genSalt: jest.fn(),
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/utils/generateToken.js", () => ({
  default: jest.fn(),
}));

const {
  SignupController,
  LoginController,
  LogoutController,
  AuthCheckController,
} = await import("../../src/controllers/auth.controllers.js");

const { default: Users } = await import("../../src/models/userModel.js");
const bcrypt = (await import("bcryptjs")).default;
const generateToken = (await import("../../src/utils/generateToken.js")).default;

const makeReq = (body = {}, user = undefined) => ({
  body,
  user,
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  clearCookie: jest.fn(),
});

const validUser = {
  _id: "user-123",
  fullName: "Test User",
  email: "test@gmail.com",
  password: "hashed-password",
  role: "USER",
};

describe("SignupController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Users.findOne.mockResolvedValue(null);
    bcrypt.genSalt.mockResolvedValue("salt");
    bcrypt.hash.mockResolvedValue("hashed-password");
  });

  test("rejects missing required fields", async () => {
    const req = makeReq({ fullName: "Test" });
    const res = makeRes();

    await SignupController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "please enter all required fields",
    });
  });

  test("rejects passwords shorter than six characters", async () => {
    const req = makeReq({
      fullName: "Test",
      email: "test@gmail.com",
      password: "12345",
    });
    const res = makeRes();

    await SignupController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Users.findOne).not.toHaveBeenCalled();
  });

  test("rejects non-Gmail addresses", async () => {
    const req = makeReq({
      fullName: "Test",
      email: "test@example.com",
      password: "password123",
    });
    const res = makeRes();

    await SignupController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please use a valid Gmail address",
    });
  });

  test("rejects an existing user", async () => {
    Users.findOne.mockResolvedValue(validUser);

    const req = makeReq({
      fullName: "Test",
      email: "test@gmail.com",
      password: "password123",
    });
    const res = makeRes();

    await SignupController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "User already Exists",
    });
  });

  test("creates a user and generates a token", async () => {
    const req = makeReq({
      fullName: "Test User",
      email: "test@gmail.com",
      password: "password123",
    });
    const res = makeRes();

    await SignupController(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("password123", "salt");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(generateToken).toHaveBeenCalledWith(res, "user-123");

    const response = res.json.mock.calls[0][0];
    expect(response.message).toBe("signedup Successfully");
    expect(response.user.email).toBe("test@gmail.com");
    expect(response.user).not.toHaveProperty("password");
  });
});

describe("LoginController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.compare.mockResolvedValue(true);
  });

  test("rejects missing credentials", async () => {
    const req = makeReq({ email: "test@gmail.com" });
    const res = makeRes();

    await LoginController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "enter credentials needed",
    });
  });

  test("rejects an unknown user", async () => {
    Users.findOne.mockResolvedValue(null);

    const req = makeReq({
      email: "test@gmail.com",
      password: "password123",
    });
    const res = makeRes();

    await LoginController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Wrong Credentials",
    });
  });

  test("rejects an incorrect password", async () => {
    Users.findOne.mockResolvedValue(validUser);
    bcrypt.compare.mockResolvedValue(false);

    const req = makeReq({
      email: "test@gmail.com",
      password: "wrong-password",
    });
    const res = makeRes();

    await LoginController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(generateToken).not.toHaveBeenCalled();
  });

  test("logs in successfully without exposing the password", async () => {
    Users.findOne.mockResolvedValue(validUser);

    const req = makeReq({
      email: "test@gmail.com",
      password: "password123",
    });
    const res = makeRes();

    await LoginController(req, res);

    expect(generateToken).toHaveBeenCalledWith(res, "user-123");
    expect(res.status).toHaveBeenCalledWith(200);

    const response = res.json.mock.calls[0][0];
    expect(response.message).toBe("Login successful");
    expect(response.user.email).toBe("test@gmail.com");
    expect(response.user).not.toHaveProperty("password");
  });
});

describe("LogoutController", () => {
  test("clears the JWT cookie and logs out", async () => {
    const req = makeReq();
    const res = makeRes();

    await LogoutController(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      "jwt",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Logged out" });
  });
});

describe("AuthCheckController", () => {
  test("returns the authenticated user", async () => {
    const user = { _id: "user-123", email: "test@gmail.com" };
    const req = makeReq({}, user);
    const res = makeRes();

    await AuthCheckController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      authenticated: true,
      user,
    });
  });
});
