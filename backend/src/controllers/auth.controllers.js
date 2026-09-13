import Users from "../models/userModel.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
});
export const SignupController = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "please enter all required fields" });
    }

    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({
        message:
          "please ensure password length is between 6 and 100 characters",
      });
    }
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(email)) {
      return res.status(400).json({
        message: "Please use a valid Gmail address",
      });
    }
    const UserExists = await Users.findOne({ email: email });
    if (UserExists) {
      return res.status(400).json({ message: "User already Exists" });
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const NewUser = new Users({
        fullName,
        email,
        password: hashedPassword,
        role: role ? role : "USER",
        activeBookingId: null,
      });

      await NewUser.save();

      generateToken(res, NewUser._id);

      return res.status(201).json({
        message: "signedup Successfully",
        user: sanitizeUser(NewUser),
      });
    }
  } catch (e) {
    console.error("error in signupController", e);
    res.status(500).json({ message: "internal sever error" });
  }
};

export const LoginController = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "enter credentials needed" });
  }
  const user = await Users.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "Wrong Credentials" });
  }
  const checkpassword = user.password;
  const check = await bcrypt.compare(password, checkpassword);

  if (!check) {
    return res.status(400).json({ message: "Wrong Credentials" });
  }

  generateToken(res, user._id);

  return res.status(200).json({
    message: "Login successful",
    user: sanitizeUser(user),
  });
};

export const LogoutController = async (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({ message: "Logged out" });
  } catch (e) {
    console.log("error in logoutController", e);
    return res.status(500).json({ message: "server error" });
  }
};

export const AuthCheckController = async (req, res) => {
  return res.status(200).json({
    authenticated: true,
    user: req.user,
  });
};
