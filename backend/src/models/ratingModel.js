import mongoose from "mongoose";

const ratingModel = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bookings",
      required: true,
    },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: String,
  },
  { timestamps: true },
);

const Ratings = mongoose.model("Ratings", ratingModel);

export default Ratings;
