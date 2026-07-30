const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's shared sandbox sender; works without a verified domain but can
// only deliver to the account's own verified address until a domain is
// verified. Override with RESEND_FROM_EMAIL once one is.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// Never throws — a slow or failing email provider must not be able to
// break the bidding/buyout action that triggered it (see lib/notifications.ts,
// which calls this without awaiting it at all).
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Failed to send email to ${to} (${response.status}): ${body}`);
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}
