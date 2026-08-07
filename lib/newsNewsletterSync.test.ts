// Pure/no-I/O helpers shared by the news create/edit API routes (issue #80)
// — directly unit-testable, same split as this project's other
// lib/*Validation.ts-style helpers.

import { describe, expect, it } from "vitest";
import { newsletterErrorMessage, parseScheduledAt, resolveOrigin } from "./newsNewsletterSync";

describe("parseScheduledAt", () => {
  it("treats empty input as 'send immediately' (ok, no scheduledAt)", () => {
    expect(parseScheduledAt("")).toEqual({ ok: true });
  });

  it("accepts a valid future date and normalizes it to ISO", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(parseScheduledAt(future)).toEqual({ ok: true, scheduledAt: future });
  });

  it("rejects a past date", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(parseScheduledAt(past)).toEqual({ ok: false });
  });

  it("rejects an unparseable date string", () => {
    expect(parseScheduledAt("not-a-date")).toEqual({ ok: false });
  });
});

describe("newsletterErrorMessage", () => {
  it("reports the NOT_CONFIGURED case the same regardless of stage", () => {
    expect(newsletterErrorMessage("NOT_CONFIGURED", "create")).toContain("尚未設定");
    expect(newsletterErrorMessage("NOT_CONFIGURED", "send")).toContain("尚未設定");
  });

  it("distinguishes create-stage vs send-stage provider errors", () => {
    const createMessage = newsletterErrorMessage("PROVIDER_ERROR", "create");
    const sendMessage = newsletterErrorMessage("PROVIDER_ERROR", "send");
    expect(createMessage).not.toEqual(sendMessage);
    expect(sendMessage).toContain("已建立");
  });
});

describe("resolveOrigin", () => {
  it("prefers X-Forwarded-Host/Proto when present (this host's reverse proxy)", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/news", {
      headers: { "x-forwarded-host": "bid.j172.tw", "x-forwarded-proto": "https" },
    });
    expect(resolveOrigin(request)).toBe("https://bid.j172.tw");
  });

  it("falls back to plain Host with https when no forwarded proto is given", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/news", {
      headers: { host: "bid.j172.tw" },
    });
    expect(resolveOrigin(request)).toBe("https://bid.j172.tw");
  });

  it("falls back to the request's own URL origin when neither header is present (local dev)", () => {
    const request = new Request("http://localhost:3000/api/admin/news");
    expect(resolveOrigin(request)).toBe("http://localhost:3000");
  });
});
