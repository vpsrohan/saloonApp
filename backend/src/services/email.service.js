import { transporter } from "../config/email.js";

export const sendEmail = async ({ to, subj, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Salon Booking" <${process.env.EMAIL_USER}>`,
      to,
      subj,
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
