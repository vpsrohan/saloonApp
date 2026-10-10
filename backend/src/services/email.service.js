import { resend } from "../config/email.js";

// ✅ Same function signature as before (to/subject/text/html in, a result
// out, throws on failure) — nothing in email.consumer.js or anywhere else
// that calls sendBookingConfirmation/sendBookingCompleted needs to change.
export const sendEmail = async ({ to, subject, text, html }) => {
  console.log("Starting email send:", {
    to,
    subject,
    provider: "resend",
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
  });

  // ✅ Use your own verified domain once you've set one up in the Resend
  // dashboard (e.g. "Salon Booking <bookings@yourdomain.com>"). Until
  // then, Resend's shared test sender works but can only send to the
  // email address you signed up to Resend with.
  const from =
    process.env.RESEND_FROM_EMAIL || "Salon Booking <onboarding@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    // Resend returns errors as a value rather than throwing — rethrow so
    // this still behaves like the old nodemailer version (and so the
    // retry loop in email.consumer.js still works correctly).
    console.error("Email sending failed:", error);
    throw new Error(error.message || "Resend API error");
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
