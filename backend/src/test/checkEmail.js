import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("PASSWORD EXISTS:", !!process.env.EMAIL_APP_PASSWORD);

import { sendEmail } from "../services/email.service.js";

await sendEmail({
  to: "vpsrohan@gmail.com",
  subject: "Salon Booking",
  text: "email check",
});
