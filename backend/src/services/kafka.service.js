import { kafka } from "../config/kafka.js";

const producer = kafka.producer();

let connected = false;

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
    topic: "email-events",
    messages: [
      {
        value: JSON.stringify(event),
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
