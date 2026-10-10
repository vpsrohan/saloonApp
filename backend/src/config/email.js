import nodemailer from "nodemailer";
import dns from "dns";

import "dotenv/config";

// ✅ Prefer IPv4 when resolving hostnames in this process. Many PaaS hosts
// (Render, Railway, etc.) don't route outbound IPv6 at all, but Node's
// default DNS resolution can still hand back an AAAA (IPv6) record for
// smtp.gmail.com, so the socket connect fails with ENETUNREACH before TLS
// even starts. This makes Node resolve A (IPv4) records first everywhere,
// not just for this one connection.
dns.setDefaultResultOrder("ipv4first");

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
  // Belt-and-suspenders: also force the socket itself to IPv4, in case
  // something upstream (a custom DNS server, a resolver cache) ignores
  // the process-wide setting above.
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});
