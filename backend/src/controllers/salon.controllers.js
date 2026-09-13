import Salons from "../models/salonModel.js";

export const addSalon = async (req, res) => {
  try {
    const { Name, services } = req.body;

    if (!Name || !services) {
      return res
        .status(400)
        .json({ message: "Please enter all details required" });
    }
    const user = req.user;

    const SalonExists = await Salons.findOne({ Name });

    if (SalonExists) {
      return res.status(400).json({ message: "Salon already exists" });
    } else {
      const newSalon = new Salons({
        Name,
        services,
        ownerId: user._id,
      });

      await newSalon.save();

      return res.status(200).json({
        newSalon,
      });
    }
  } catch (e) {
    console.log("error in addSalon controller", e);
    res.status(500).json("server error");
  }
};

export const getAllSalons = async (req, res) => {
  try {
    const allSalons = await Salons.find({ isActive: true });

    return res.status(200).json(allSalons);
  } catch (e) {
    console.log("error in getAllSalons controller", e);
    res.status(500).json("server error");
  }
};

export const getSalon = async (req, res) => {
  try {
    const salonId = req.params.id;
    const salon = await Salons.findById(salonId);
    if (!salon || !salon.isActive) {
      return res.status(400).json({ message: "The salon doesnt exist" });
    }

    const services = salon.services.filter((service) => service.isActive);

    return res.status(200).json({
      _id: salon._id,
      name: salon.Name,
      ratingAvg: salon.ratingAvg,
      ratingCnt: salon.ratingCnt,
      ownerId: salon.ownerId, // ✅ Added this
      services: services,
    });
  } catch (e) {
    console.log("error in getSalon controller", e);
    return res.status(400).json("server error");
  }
};

export const updateSalon = async (req, res) => {
  try {
    const id = req.params.id;

    const salon = await Salons.findById(id);
    if (!salon) {
      return res.status(404).json({ message: "Salon not found" });
    }

    if (salon.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ✅ Fixed: model uses 'Name' not 'name'
    salon.Name = req.body.Name || salon.Name;
    // ✅ Fixed: properly handle boolean false
    salon.isActive =
      req.body.isActive !== undefined ? req.body.isActive : salon.isActive;

    if (req.body.services !== undefined) {
      if (!Array.isArray(req.body.services)) {
        return res.status(400).json({ message: "Services must be an array" });
      }

      salon.services = req.body.services;
    }

    await salon.save();

    return res.status(200).json(salon);
  } catch (e) {
    console.log("error in updateSalon controller", e);
    res.status(500).json({ message: "server error" });
  }
};

export const deleteSalon = async (req, res) => {
  try {
    const salon = await Salons.findById(req.params.id);

    if (!salon) {
      return res.status(404).json({
        message: "Salon not found",
      });
    }
    if (salon.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Not authorized to delete this salon",
      });
    }

    salon.isActive = false;
    await salon.save();

    return res.status(200).json({
      message: "Salon deleted successfully",
    });
  } catch (err) {
    console.error("Error in deleteSalon:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};
