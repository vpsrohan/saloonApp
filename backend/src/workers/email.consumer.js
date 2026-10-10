import { kafka } from "../config/kafka.js";
import {
  sendBookingConfirmation,
  sendBookingCompleted,
} from "../services/email.service.js";

const consumer = kafka.consumer({
  groupId: "email-service",
});

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processEvent = async (event) => {
  if (!event?.type || !event?.data) {
    throw new Error("Invalid email event payload");
  }

  switch (event.type) {
    case "BOOKING_CREATED":
      await sendBookingConfirmation(event.data);
      break;

    case "BOOKING_COMPLETED":
      await sendBookingCompleted(event.data);
      break;

    default:
      throw new Error(`Unknown email event type: ${event.type}`);
  }
};

const handleMessage = async (message) => {
  if (!message.value) {
    throw new Error("Kafka message has no value");
  }

  const event = JSON.parse(message.value.toString());

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(
        `Processing ${event.type}, attempt ${attempt}/${MAX_ATTEMPTS}`,
      );

      await processEvent(event);

      console.log(`Email event processed: ${event.type}`);
      return;
    } catch (error) {
      console.error(
        `Email attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        error.message,
      );

      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
};

const run = async () => {
  await consumer.connect();
  console.log("Email consumer connected");

  await consumer.subscribe({
    topic: "email-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      await handleMessage(message);
    },
  });
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down email consumer...`);

  try {
    await consumer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Consumer shutdown failed:", error);
    process.exit(1);
  }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

run().catch(async (error) => {
  console.error("Email consumer crashed:", error);

  try {
    await consumer.disconnect();
  } catch (disconnectError) {
    console.error("Consumer disconnect failed:", disconnectError);
  }

  process.exitCode = 1;
});
