import { kafka } from "../config/kafka.js";
import {
  sendBookingConfirmation,
  sendBookingCompleted,
} from "../services/email.service.js";
import { publishToDLQ, EMAIL_EVENTS_TOPIC } from "../services/kafka.service.js";

const consumer = kafka.consumer({
  groupId: "email-service",
});

const handlers = {
  BOOKING_CREATED: sendBookingConfirmation,
  BOOKING_COMPLETED: sendBookingCompleted,
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  await consumer.connect();

  console.log("Email consumer connected");

  await consumer.subscribe({
    topic: EMAIL_EVENTS_TOPIC,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      let event;
      try {
        event = JSON.parse(message.value.toString());
      } catch (parseError) {
        console.error("Malformed event JSON, sending to DLQ:", parseError);
        await sendToDLQOrThrow(
          { raw: message.value.toString() },
          { attempts: 0, lastError: "Invalid JSON" },
        );
        return;
      }

      console.log("Received event:", event.type);

      const handler = handlers[event.type];
      if (!handler) {
        console.log("Unknown email event type, sending to DLQ:", event.type);
        await sendToDLQOrThrow(event, {
          attempts: 0,
          lastError: `No handler for type "${event.type}"`,
        });
        return;
      }

      let lastError = null;
      let attemptsMade = 0;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        attemptsMade = attempt;
        try {
          await handler(event.data);
          return; // success — offset commits, next message proceeds
        } catch (error) {
          lastError = error;
          console.error(
            `Email send failed (attempt ${attempt}/${MAX_ATTEMPTS}) for ${event.type}:`,
            error.code ? `[${error.code}] ${error.message}` : error.message,
          );

          // ✅ A permanent error (bad API key, unverified domain, invalid
          // recipient) will never succeed no matter how many times we
          // retry — stop burning attempts/backoff on it and DLQ it now.
          if (error.permanent) {
            console.error(
              `Permanent error (${error.code || "unknown"}) for ${event.type} — skipping remaining retries.`,
            );
            break;
          }

          if (attempt < MAX_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS * attempt);
          }
        }
      }

      console.error(
        `Giving up on ${event.type} for ${event.data?.to} after ${attemptsMade} attempt(s) — moving to DLQ.`,
      );

      await sendToDLQOrThrow(event, {
        attempts: attemptsMade,
        lastError: lastError?.message || "Unknown error",
      });
    },
  });
};

// ✅ Wraps the DLQ publish. If it succeeds, we return normally and
// KafkaJS commits the original message's offset — the queue moves on.
// If it FAILS, we must NOT swallow that: returning normally here would
// let the offset commit anyway, silently losing the event (it's not in
// the original topic's unprocessed set anymore, and it never made it
// into the DLQ either). So we rethrow, which keeps this message
// un-committed and lets KafkaJS redeliver it — at the cost of blocking
// this partition until the DLQ/Kafka connection itself recovers. That's
// the right trade: a stalled consumer is visible (lag/crash alerts) and
// recoverable; a silently dropped booking confirmation is not.
const sendToDLQOrThrow = async (event, failureInfo) => {
  try {
    await publishToDLQ(event, failureInfo);
  } catch (dlqError) {
    console.error(
      "CRITICAL: failed to publish to DLQ; original message must be retried:",
      dlqError,
    );
    throw dlqError;
  }
};

let shuttingDown = false;

const shutDown = async (signal) => {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`${signal} received. Shutting down email consumer.....`);

  try {
    await consumer.stop();
    console.log("Email consumer stopped");

    await consumer.disconnect();
    console.log("Email consumer disconnected");
  } catch (e) {
    console.error("Error shutting down email consumer", e);
    process.exitCode = 1;
  }
};

process.once("SIGTERM", () => shutDown("SIGTERM"));
process.once("SIGINT", () => shutDown("SIGINT"));

run().catch((error) => {
  console.error("Email consumer crashed:", error);
  process.exitCode = 1;
});
