import { kafka } from "../config/kafka.js";

const producer = kafka.producer();

let connected = false;

export const EMAIL_EVENTS_TOPIC = "email-events";
export const EMAIL_EVENTS_DLQ_TOPIC = "email-events-dlq";

export const connectKafkaProducer = async () => {
  if (connected) return;

  await producer.connect();
  connected = true;

  console.log("kafka producer connected");
};

export const publishEmailEvent = async (event) => {
  if (!connected) {
    await connectKafkaProducer();
  }

  await producer.send({
    topic: EMAIL_EVENTS_TOPIC,
    messages: [
      {
        value: JSON.stringify(event),
      },
    ],
  });
};

// ✅ New: park a message here once the consumer has given up on it, so a
// permanently-failing message (bad address, stale data, whatever) gets
// taken off the main topic instead of being retried forever and blocking
// every message behind it. Nothing is lost — it's just moved somewhere
// that isn't on the critical path, for later inspection/replay.
export const publishToDLQ = async (originalEvent, failureInfo) => {
  if (!connected) {
    await connectKafkaProducer();
  }

  await producer.send({
    topic: EMAIL_EVENTS_DLQ_TOPIC,
    messages: [
      {
        value: JSON.stringify({
          originalEvent,
          failedAt: new Date().toISOString(),
          attempts: failureInfo.attempts,
          lastError: failureInfo.lastError,
        }),
      },
    ],
  });
};

export const disconnectKafkaProducer = async () => {
  if (!connected) return;

  await producer.disconnect();
  connected = false;

  console.log("Kafka producer disconnected");
};
