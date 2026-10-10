import { transporter } from "../config/email.js";

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    console.log("subject", subject);
    console.log("Starting email send:", {
      to,
      subject,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      userConfigured: Boolean(process.env.EMAIL_USER),
      passwordConfigured: Boolean(process.env.EMAIL_APP_PASSWORD),
    });

    const info = await transporter.sendMail({
      from: `"Salon Booking" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email Sent:", info.messageId);

    return info;
  } catch (e) {
    console.error("Email sending failed", e);
    throw e;
  }
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
