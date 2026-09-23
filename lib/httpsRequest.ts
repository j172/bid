import { Agent, request } from "https";

// Deliberately node:https instead of the global fetch(): on this host,
// fetch()'s underlying undici implementation instantiates a WASM module that
// fails under this account's LVE memory ceiling ("RangeError:
// WebAssembly.instantiate(): Out of memory"), breaking every outbound call.
// node:https has no such dependency.
//
// This is only the transport — send a request, buffer the whole response,
// resolve with status + body. Each caller still builds its own URL, headers
// and payload, because that's the part that legitimately differs (Resend's
// authenticated POST-JSON API vs TAIFEX's unauthenticated CSV GET); what got
// copied around was the ~10 lines of stream plumbing underneath (issue
// #139), which is also the part where a forgotten `req.end()` or a missing
// error handler hangs a request forever.
//
// Rejects with node:https's raw error — never fetch()'s
// `TypeError: fetch failed` wrapper, which nests the real cause (with
// errno/code on the nested object) and changes what callers' catch blocks
// can usefully log.

// Issue #344 A-2: one Agent shared by every httpsRequest() call (Resend in
// email.ts, TAIFEX in exchangeRates.ts, Cloudflare in turnstile.ts and
// translate.ts, IndexNow/YouTube RSS in indexnow.ts/socialMedia.ts) instead
// of node:https's default of a fresh TCP+TLS handshake per request. bid
// doesn't hand node:https a custom CA bundle the way health did (that's what
// made health's per-request Agent rebuild native-heap-expensive — see
// docs/specs/httpclient-shared-tls-agent.md over there), so this is purely a
// connection-reuse optimization, not a fix for a crash. All current callers
// only ever target https:// URLs, so there's no matching http.Agent — add
// one only if a caller ever needs plain HTTP.
const keepAliveAgent = new Agent({ keepAlive: true });

export function httpsRequest(
  url: string,
  options: { method: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {
    method: "GET",
  },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method, headers: options.headers, agent: keepAliveAgent }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    // Optional idle/overall timeout (issue #344 A-1): destroying the request
    // on timeout makes it emit "error", which the handler above already
    // turns into a rejection — no separate reject() call needed here. Only
    // set when a caller opts in (indexnow.ts/socialMedia.ts do, replacing
    // their former AbortSignal.timeout(...)); existing callers that don't
    // pass timeoutMs keep their current no-timeout behavior unchanged.
    if (options.timeoutMs !== undefined) {
      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new Error(`Request to ${url} timed out after ${options.timeoutMs}ms`));
      });
    }
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
