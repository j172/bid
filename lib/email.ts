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
function postJson(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

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
    const { status, body } = await postJson(
      "https://api.resend.com/emails",
      { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    );

    if (status < 200 || status >= 300) {
      console.error(`Failed to send email to ${to} (${status}): ${body}`);
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}
