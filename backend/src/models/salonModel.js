import mongoose from "mongoose";

const serviceSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    maxPerSlot: { type: Number, required: true },
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const salonModel = mongoose.Schema(
  {
    Name: {
      type: String,
      required: true,
      unique: true,
    },
    ratingAvg: {
      type: Number,
      default: 0,
    },
    ratingCnt: {
      type: Number,
      default: 0,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    services: [serviceSchema],
  },
  { timestamps: true },
);

salonModel.index({
  Name: 1,
});
const Salons = mongoose.model("Salons", salonModel);

export default Salons;
