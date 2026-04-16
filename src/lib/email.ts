/**
 * Email delivery seam.
 *
 * Today this just logs to the server console so you can copy/paste the reset
 * link during development. When you're ready to wire up a real provider
 * (Resend, Postmark, SES), replace the body of `sendEmail` with a fetch call
 * and set:
 *   EMAIL_PROVIDER=resend
 *   EMAIL_FROM="Pick 6 Golf <noreply@yourdomain.com>"
 *   RESEND_API_KEY=...
 *
 * Keeping the interface small makes that swap a 10-line diff.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM ?? "noreply@example.com";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Resend send failed:", res.status, body);
      throw new Error("Email delivery failed");
    }
    return;
  }

  // Dev / unconfigured: log only. Never throws so app flow isn't broken.
  console.log("\n─── [DEV EMAIL] ──────────────────────────");
  console.log("To:     ", msg.to);
  console.log("Subject:", msg.subject);
  console.log(msg.text);
  console.log("──────────────────────────────────────────\n");
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
