import { request } from "https";

// Resend's shared sandbox sender; works without a verified domain but can
// only deliver to the account's own verified address until a domain is
// verified. Override with RESEND_FROM_EMAIL once one is.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// Deliberately node:https instead of the global fetch(): on this host,
// fetch()'s underlying undici implementation instantiates a WASM module
// that fails under this account's LVE memory ceiling ("RangeError:
// WebAssembly.instantiate(): Out of memory"), breaking every outbound
// call. node:https has no such dependency.
//
// Shared by every Resend caller (transactional email, audience signup,
// broadcasts) so they all inherit this workaround from one place.
export function resendRequest(method: string, path: string, body?: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (payload !== undefined) headers["Content-Length"] = String(Buffer.byteLength(payload));

    const req = request(`https://api.resend.com${path}`, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

// Never throws — a slow or failing email provider must not be able to
// break the bidding/buyout action that triggered it (see lib/notifications.ts,
// which calls this without awaiting it at all).
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error(`RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }

  try {
    const { status, body } = await resendRequest("POST", "/emails", { from: FROM_ADDRESS, to, subject, html });

    if (status < 200 || status >= 300) {
      console.error(`Failed to send email to ${to} (${status}): ${body}`);
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

export type NewsletterSubscribeResult = { ok: true } | { ok: false; errorCode: "NOT_CONFIGURED" | "PROVIDER_ERROR" };

// Adds a contact to the Resend Audience that backs the footer newsletter
// signup. Re-subscribing an email Resend already has on file (status 409)
// is treated as success since the user's intent (be on the list) is met.
export async function subscribeNewsletter(email: string): Promise<NewsletterSubscribeResult> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_AUDIENCE_ID) {
    console.error("RESEND_API_KEY or RESEND_AUDIENCE_ID not set — skipping newsletter signup");
    return { ok: false, errorCode: "NOT_CONFIGURED" };
  }

  try {
    const { status, body } = await resendRequest("POST", `/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`, {
      email,
      unsubscribed: false,
    });

    if ((status >= 200 && status < 300) || status === 409) {
      return { ok: true };
    }

    console.error(`Failed to subscribe ${email} to newsletter (${status}): ${body}`);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  } catch (error) {
    console.error(`Failed to subscribe ${email} to newsletter:`, error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}
