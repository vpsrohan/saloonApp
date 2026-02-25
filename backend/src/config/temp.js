import mongoose from "mongoose";
import Users from "../models/userModel.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const user = await Users.findOneAndUpdate(
      { email: "vpsrohan@gmail.com" },
      { role: "ADMIN" },
      { new: true },
    );

    console.log("Updated user:", user);

    await mongoose.connection.close();
    console.log("Connection closed");
  } catch (err) {
    console.error("Error updating user role:", err);
  }
};

run();
