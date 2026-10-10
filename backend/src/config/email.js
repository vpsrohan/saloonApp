import { Resend } from "resend";
import "dotenv/config";

// ✅ Swapped from Gmail SMTP to Resend's HTTP API. Your host's outbound
// SMTP ports (465/587) are blocked at the network level — confirmed by
// the IPv4 fix making no difference — which is standard on free/hobby
// PaaS tiers to prevent spam relaying. An HTTP API sends over port 443
// (HTTPS), which is never blocked, so this sidesteps the problem instead
// of fighting it.
//
// Setup:
//   npm install resend
//   Sign up at resend.com (free tier: 3,000 emails/month, 100/day)
//   Add RESEND_API_KEY to your production env vars
//   Verify a sending domain in the Resend dashboard (or use their
//   shared `onboarding@resend.dev` sender while testing)
export const resend = new Resend(process.env.RESEND_API_KEY);
