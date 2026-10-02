import { sendBookingConfirmation } from "../services/email.service.js";

await sendBookingConfirmation({
  to: "vpsrohan@gmail.com",
  bookingId: "123",
  salonName: "salon",
  serviceName: "haircut",
  slotStart: new Date(),
  queueNumber: 1,
});
