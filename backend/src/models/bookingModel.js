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
      enum: ["PENDING", "PROGRESS", "DONE", "CANCELLED"],
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

bookingModel.index({
  userId: 1,
  createdAt: -1,
});

bookingModel.index({
  salonId: 1,
  slotStart: 1,
});

bookingModel.index({
  userId: 1,
  status: 1,
  slotStart: 1,
  slotEnd: 1,
});

bookingModel.index({
  salonId: 1,
  serviceId: 1,
  slotStart: 1,
  status: 1,
});

const Bookings = mongoose.model("Bookings", bookingModel);

export default Bookings;
