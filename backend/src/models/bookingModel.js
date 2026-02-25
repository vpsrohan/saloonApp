import mongoose from "mongoose";

const bookingModel = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      required: true,
      ref: "User",
    },
    salonId: {
      type: mongoose.Schema.ObjectId,
      required: true,
      ref: "Salons",
    },
    serviceId: {
      type: mongoose.Schema.ObjectId,
      required: true,
    },
    slotStart: {
      type: Date,
      required: true,
    },
    slotEnd: {
      type: Date,
      required: true,
    },
    queueNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      ENUM: ["PENDING", "PROGRESS", "DONE", "CANCELLED"],
      required: true,
    },
  },
  { timestamps: true },
);

const Bookings = mongoose.model("Bookings", bookingModel);

export default Bookings;
