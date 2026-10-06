import { kafka } from "../config/kafka.js";
import {
  sendBookingConfirmation,
  sendBookingCompleted,
} from "../services/email.service.js";

const consumer = kafka.consumer({
  groupId: "email-service",
});

const run = async () => {
  await consumer.connect();

  console.log("Email consumer connected");

  await consumer.subscribe({
    topic: "email-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());

        console.log("Received event:", event.type);

        switch (event.type) {
          case "BOOKING_CREATED":
            await sendBookingConfirmation(event.data);
            break;

          case "BOOKING_COMPLETED":
            await sendBookingCompleted(event.data);
            break;

          default:
            console.log("Unknown email event:", event.type);
        }
      } catch (error) {
        console.error("Email consumer failed:", error);
      }
    },
  });
};

run().catch((error) => {
  console.error("Email consumer crashed:", error);
});
