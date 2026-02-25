import Salons from "../models/salonModel.js";
import jwt from "jsonwebtoken";

export const checkAdmin = async (req, res, next) => {
  const user = req.user;

  if (user.role != "ADMIN") {
    return res
      .status(403)
      .json({ message: "user is not authenticated to add this" });
  }

  next();
};
