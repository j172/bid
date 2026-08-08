import { request } from "https";

// Cloudflare Turnstile anti-abuse check for the public /contact form (issue
// #104). CLOUDFLARE_TURNSTILE_SITE_KEY (not secret — safe in the client
// form) and CLOUDFLARE_TURNSTILE_SECRET_KEY belong to the site's existing
// "j172tw" Turnstile widget; both live in .env only, never committed.

// Deliberately node:https instead of the global fetch(), same reasoning as
// lib/email.ts's resendRequest: fetch()'s underlying undici implementation
// OOMs under this host's memory ceiling, so every outbound call in this
// project goes through node:https instead.
function turnstileSiteverifyRequest(secret: string, token: string, remoteIp: string | null): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);
    const payload = params.toString();

    const req = request(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": String(Buffer.byteLength(payload)),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Pure interpretation of siteverify's JSON response body — directly
// unit-testable without a network call, same split as
// lib/newsletter.ts's buildNewsBroadcastHtml. Canonical response shape is
// `{ success: boolean, "error-codes"?: string[], ... }`; anything that
// doesn't parse or doesn't have success === true is treated as a failed
// verification (fail closed).
export function parseTurnstileVerifyBody(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { success?: unknown };
    return parsed.success === true;
  } catch {
    return false;
  }
}

// Never throws — mirrors lib/email.ts's sendEmail contract, so callers
// don't need a try/catch of their own. A missing secret, network error,
// non-2xx response, or success:false in the body are all just "not
// verified"; the caller (app/api/contact/route.ts) rejects the submission
// either way.
export async function verifyTurnstileToken(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("CLOUDFLARE_TURNSTILE_SECRET_KEY not set — rejecting Turnstile verification");
    return false;
  }
  if (!token) return false;

  try {
    const { status, body } = await turnstileSiteverifyRequest(secret, token, remoteIp);
    if (status < 200 || status >= 300) {
      console.error(`Turnstile siteverify failed (${status}): ${body}`);
      return false;
    }
    return parseTurnstileVerifyBody(body);
  } catch (error) {
    console.error("Turnstile siteverify request failed:", error);
    return false;
  }
}
