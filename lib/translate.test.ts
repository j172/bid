// lib/translate.ts wraps a single httpsRequest call, so like
// lib/exchangeRates.test.ts this mocks @/lib/httpsRequest and asserts on the
// request built / the result mapped back from Cloudflare's response shape.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { httpsRequestMock } = vi.hoisted(() => ({ httpsRequestMock: vi.fn() }));

vi.mock("@/lib/httpsRequest", () => ({
  httpsRequest: httpsRequestMock,
}));

import { isTranslationConfigured, translateToTraditionalChinese } from "./translate";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  httpsRequestMock.mockReset();
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct_123";
  process.env.CLOUDFLARE_AI_API_TOKEN = "token_abc";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isTranslationConfigured", () => {
  it("is true once both env vars are set", () => {
    expect(isTranslationConfigured()).toBe(true);
  });

  it("is false when either env var is missing", () => {
    delete process.env.CLOUDFLARE_AI_API_TOKEN;
    expect(isTranslationConfigured()).toBe(false);
  });
});

describe("translateToTraditionalChinese", () => {
  it("short-circuits blank input without making a network call", async () => {
    const result = await translateToTraditionalChinese("   ");
    expect(result).toEqual({ ok: true, text: "" });
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("returns a typed failure without calling the network when credentials are missing", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    const result = await translateToTraditionalChinese("hello");
    expect(result.ok).toBe(false);
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("calls Workers AI's m2m100 model with the expected URL/auth/body", async () => {
    httpsRequestMock.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ success: true, result: { translated_text: "哈啰世界" } }),
    });

    await translateToTraditionalChinese("hello world");

    const [url, options] = httpsRequestMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct_123/ai/run/@cf/meta/m2m100-1.2b");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer token_abc");
    // target_lang is "chinese" (bare), not "chinese_traditional" — the
    // model's real API rejects the latter with a 400 (confirmed against the
    // live API; see this file's header comment). The response is Simplified
    // Chinese by design; converting it is this function's job, tested below.
    expect(JSON.parse(options.body)).toEqual({
      text: "hello world",
      source_lang: "english",
      target_lang: "chinese",
    });
  });

  it("converts Workers AI's Simplified Chinese response to Traditional before returning it", async () => {
    // 冠军/鸽子/赢 are all Simplified forms — 冠軍/鴿子/贏 are their Traditional
    // counterparts. A model response coming back in Simplified script (as
    // Workers AI's m2m100 always does — it has no distinct Traditional
    // output option) must never reach a caller unconverted.
    httpsRequestMock.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ success: true, result: { translated_text: "冠军鸽子赢得了第一名。" } }),
    });

    const result = await translateToTraditionalChinese("The champion pigeon won first place.");

    expect(result).toEqual({ ok: true, text: "冠軍鴿子贏得了第一名。" });
  });

  it("returns a typed failure on a non-2xx response", async () => {
    httpsRequestMock.mockResolvedValueOnce({ status: 500, body: "internal error" });
    const result = await translateToTraditionalChinese("hello");
    expect(result.ok).toBe(false);
  });

  it("returns a typed failure when Cloudflare reports success:false", async () => {
    httpsRequestMock.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ success: false, errors: [{ message: "bad model" }] }),
    });
    const result = await translateToTraditionalChinese("hello");
    expect(result).toEqual({ ok: false, error: "bad model" });
  });

  it("returns a typed failure when the request throws", async () => {
    httpsRequestMock.mockRejectedValueOnce(new Error("network down"));
    const result = await translateToTraditionalChinese("hello");
    expect(result).toEqual({ ok: false, error: "network down" });
  });
});
