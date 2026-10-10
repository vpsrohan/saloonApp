import { Kafka } from "kafkajs";
import "dotenv/config";
import fs from "fs";

export const kafka = new Kafka({
  clientId: "salon-booking-backend",
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    ca: [fs.readFileSync("./certs/ca.pem", "utf-8")],
  },
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
});
