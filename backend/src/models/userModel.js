import express from "express";
import mongoose from "mongoose";

const userModel = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      maxLength: 100,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
    activeBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bookings",
    },
  },
  { timestamps: true },
);

const Users = mongoose.model("User", userModel);

export default Users;
