// Guards the baseline security response headers added for issue #140 M-3.
// They're declarative config rather than logic, but they're also exactly the
// kind of thing a later config edit can drop without anything failing — this
// pins the set (and the values) so removing one is a visible test failure.
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config.js";

const config = nextConfig as {
  headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
};

describe("next.config.js headers()", () => {
  it("applies the baseline security headers to every route", async () => {
    const rules = await config.headers();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");

    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers).toEqual({
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
  });
});
