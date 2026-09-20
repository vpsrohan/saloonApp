import Salons from "../models/salonModel.js";

export const listSalons = async () => {
  const salons = await Salons.find(
    { isActive: true },
    {
      Name: 1,
      ratingAvg: 1,
    },
  );

  return salons;
};

export const getSalonServices = async (salonName) => {
  const salon = await Salons.findOne({
    Name: salonName,
    isActive: true,
  });

  if (!salon) {
    return null;
  }

  return salon.services.filter((service) => service.isActive);
};
