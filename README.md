# Salon Booking System

A full-stack salon booking platform that lets users discover salons, explore services, book time slots, and manage their bookings. The backend uses Redis for booking coordination, MongoDB for persistent storage, Kafka for asynchronous email notifications, and an LLM-powered chat assistant for salon and booking queries.

## Live Demo

- **Frontend:** https://saloon-frontend-jj2g.onrender.com
- **Backend health check:** https://saloon-backend-nalu.onrender.com/health

## Features

- **Authentication and authorization:** JWT-based authentication with protected API routes.
- **Salon discovery:** Browse salons and their available services.
- **Slot-based booking:** Create bookings for selected services and time slots.
- **Booking coordination:** Redis locks help coordinate competing booking requests.
- **Idempotent booking requests:** Idempotency keys help prevent duplicate bookings when a request is retried.
- **Persistent storage:** MongoDB stores application data, with indexes supporting key queries and uniqueness constraints.
- **Asynchronous notifications:** Kafka-based email event processing for booking-related notifications.
- **AI chat assistant:** Controlled LLM tool calling for salon discovery, service lookup, availability checks, and user booking queries.
- **Automated tests:** Jest-based test suite covering authentication, booking, salon, and chat functionality.

## Tech Stack

| Layer                    | Technologies                      |
| ------------------------ | --------------------------------- |
| Frontend                 | React                             |
| Backend                  | Node.js, Express.js               |
| Database                 | MongoDB, Mongoose                 |
| Coordination and caching | Redis, Upstash                    |
| Authentication           | JWT, bcryptjs                     |
| Messaging                | Apache Kafka, KafkaJS             |
| Email                    | Nodemailer                        |
| AI integration           | Groq SDK, controlled tool calling |
| Testing                  | Jest                              |

## Architecture

```text
React Frontend
      |
      v
Express REST API
      |
      +---- JWT Authentication
      |
      +---- MongoDB / Mongoose
      |       Users, salons, services, bookings
      |
      +---- Redis
      |       Booking coordination
      |
      +---- Kafka
      |       Email notification events
      |
      +---- Groq LLM
              Controlled tool calling
```

## Booking Flow

1. The authenticated user submits a booking request with the salon, service, slot start time, and an idempotency key.
2. The API validates the request and checks whether the same user has already created a booking with that key.
3. The backend acquires a Redis lock for the normalized salon, service, and slot combination.
4. While holding the lock, the backend validates the salon and service, checks booking constraints, and creates the booking in MongoDB.
5. The backend attempts to publish a notification event to Kafka.
6. The lock is released using its owner token, so a request cannot release a lock acquired by another request.

Redis locking and idempotency address different concerns: locking coordinates access to a booking slot, while idempotency handles repeated submissions of the same logical request.

## AI Assistant

The chat backend uses an LLM with a controlled set of application tools. These tools allow the assistant to look up salons and services, check availability, and retrieve a user's bookings.

The assistant is intended for information retrieval and guided discovery. Booking creation remains part of the regular application UI and API flow.

## Getting Started

### Prerequisites

- Node.js and npm
- MongoDB connection string
- Redis/Upstash credentials
- Kafka broker credentials if email event processing is enabled
- Groq API key for AI chat functionality

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd saloonApp
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory and configure the environment variables expected by the application.

Typical configuration includes:

```env
PORT=3000
MONGO_URI=
JWT_SECRET=
REDIS_URL=
REDIS_TOKEN=
GROQ_API_KEY=
EMAIL_USER=
EMAIL_APP_PASSWORD=
```

Add the Kafka broker and authentication settings required by your Kafka configuration. Check the backend configuration files for the exact environment variable names.

Never commit real credentials or production secrets.

### 3. Start the backend

```bash
npm run dev
```

Use the backend's configured start script if it differs from `npm run dev`.

### 4. Set up the frontend

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend API base URL to point to the local backend. Check the frontend's existing environment variable names before adding one.

## Testing

Run the backend test suite from the backend directory:

```bash
npm test
```

The test suite covers authentication, booking, salon, and chat behavior.

The project has previously reported 67 passing tests across five suites. Run the current suite to confirm the result after dependency updates.

## Engineering Considerations

- **Lock ownership:** Redis locks use unique tokens and conditional release.
- **Request retries:** Idempotency keys help make repeated booking submissions safe.
- **Database constraints:** Unique indexes provide additional protection against duplicate records where configured.
- **Failure isolation:** Email notification failures should not incorrectly report an otherwise successful booking as failed.
- **LLM boundaries:** AI tool access is restricted to explicitly implemented application operations.

## Future Improvements

- Automated concurrency and duplicate-request verification.
- Additional integration tests for failure and recovery scenarios.
- Improved observability for booking and notification workflows.

## License

Add a license if you intend to distribute or open-source this project.
