import { resend } from "../config/email.js";

// Resend error codes that are safe to retry — transient/infra-side, not a
// property of the message itself. Anything NOT in this set (bad API key,
// unverified sender domain, invalid recipient, validation errors, etc.)
// is treated as permanent: retrying it will never succeed, so the
// consumer should send it straight to the DLQ instead of burning retry
// attempts on it.
const TRANSIENT_ERROR_CODES = new Set([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
]);

export const sendEmail = async ({ to, subject, text, html }) => {
  console.log("Starting email send:", {
    to,
    subject,
    provider: "resend",
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
  });

  const from =
    process.env.RESEND_FROM_EMAIL || "Salon Booking <onboarding@resend.dev>";

  let data, error;
  try {
    ({ data, error } = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
    }));
  } catch (networkErr) {
    // The SDK call itself threw (network/DNS/timeout) before we even got
    // a structured API response — that's infra-side, so treat as
    // retryable rather than guessing it's permanent.
    console.error("Email request failed (network/transport):", networkErr);
    const err = new Error(networkErr.message || "Email request failed");
    err.permanent = false;
    throw err;
  }

  if (error) {
    console.error("Email sending failed:", error);

    const err = new Error(error.message || "Resend API error");
    err.code = error.name; // e.g. "validation_error", "invalid_api_key"
    // Conservative default: anything NOT explicitly listed as transient
    // is treated as permanent (skip remaining retries, go to DLQ). This
    // is deliberately the stricter default — most Resend 4xx errors
    // (bad API key, unverified domain, restricted recipient in test
    // mode, validation errors) are client-side and will never succeed
    // on retry, so there's no reason to burn attempts on them. Only
    // known infra-side codes below get retried.
    err.permanent = !TRANSIENT_ERROR_CODES.has(error.name);
    throw err;
  }

  console.log("Email sent:", data.id);
  return data;
};

export const sendBookingConfirmation = async ({
  to,
  bookingId,
  salonName,
  serviceName,
  slotStart,
  queueNumber,
}) => {
  const date = new Date(slotStart);

  await sendEmail({
    to,
    subject: "Booking confirmed -Salon Booking",
    text: `
    Your salon booking has been confirmed.

    Booking ID: ${bookingId}
    Salon: ${salonName}
    Service: ${serviceName}
    Date: ${date.toLocaleDateString("en-IN")}
    Time: ${date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}
    Queue Number: ${queueNumber}

    Thank you for using our Salon Booking System.
    `,
  });
};

export const sendBookingCompleted = async ({
  to,
  bookingId,
  salonName,
  serviceName,
}) => {
  await sendEmail({
    to,
    subject: "Booking Completed - Salon Booking",
    text: `
Your salon booking has been completed.

Booking ID: ${bookingId}
Salon: ${salonName}
Service: ${serviceName}

Thank you for using our Salon Booking System.
    `,
  });
};
