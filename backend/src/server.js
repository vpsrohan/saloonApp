import express from "express";
import dotenv from "dotenv";

import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import salonRoutes from "./routes/salon.route.js";
import bookingRoutes from "./routes/booking.route.js";
import ratingRoutes from "./routes/rating.route.js";
import chatRoutes from "./routes/chat.routes.js";
import { disconnectKafkaProducer } from "./services/kafka.service.js";
import { disconnectDB } from "./config/db.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);
// console.log("json middleware addeed");
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/salons", salonRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/chat", chatRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
const PORT = process.env.PORT || 3000;

let server;
let shuttingDown = false;

const startServer = async () => {
  await connectDB();

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down server...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      console.log("HTTP server closed.");
    }

    await disconnectKafkaProducer();
    console.log("Kafka producer disconnected.");

    await disconnectDB();
    //  console.log("MongoDb disconnected");
  } catch (error) {
    console.error("Error during server shutdown:", error);
    process.exitCode = 1;
  }
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
