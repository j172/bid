import { request } from "https";

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
export function httpsRequest(
  url: string,
  options: { method: string; headers?: Record<string, string>; body?: string } = { method: "GET" },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method, headers: options.headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
