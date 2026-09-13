import Bookings from "../models/bookingModel.js";
import Ratings from "../models/ratingModel.js";
import Salons from "../models/salonModel.js";

export const addRating = async (req, res) => {
  try {
    const { bookingId, stars, comment } = req.body;

    const userId = req.user._id;
    const booking = await Bookings.findById({ bookingId });

    if (!stars || !booking) {
      return res
        .status(401)
        .json({ message: "Please provide rating and booking details" });
    }

    if (booking.status !== "DONE") {
      return res.status(401).json({ message: "Booked Service not completed" });
    }

    if (booking.userId.toString() !== userId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to rate for this booking" });
    }

    const ratingCheck = Ratings.findOne({ bookingId });

    if (ratingCheck) {
      return res.status(400).json("Already rated for this booking");
    }

    const newRating = await Ratings.create({
      userId,
      salonId: booking.salonId,
      bookingId,
      stars,
      comment,
    });

    await newRating.save();

    const salon = Salons.findById(booking.salonId);

    salon.ratingAvg =
      (salon.ratingAvg * salon.ratingCnt + stars) / (salon.ratingCnt + 1);

    salon.ratingCnt += 1;

    await salon.save();

    return res.status(200).json(newRating);
  } catch (e) {
    console.log("error in addRating controller", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getRating = async (req, res) => {
  try {
    const salonId = req.params.id;

    const ratings = await Ratings.find({ salonId })
      .populate("userId", "fullName")
      .sort({ createdAt: -1 });

    return res.status(200).json(ratings);
  } catch (e) {
    console.error("error in getSalonRatings", e);
    return res.status(500).json({ message: "Server error" });
  }
};
