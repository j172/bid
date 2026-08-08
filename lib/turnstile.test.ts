import { describe, expect, it } from "vitest";
import { parseTurnstileVerifyBody } from "./turnstile";

describe("parseTurnstileVerifyBody", () => {
  it("returns true when success is true", () => {
    expect(parseTurnstileVerifyBody(JSON.stringify({ success: true }))).toBe(true);
  });

  it("returns false when success is false", () => {
    expect(parseTurnstileVerifyBody(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }))).toBe(false);
  });

  it("returns false when success is missing", () => {
    expect(parseTurnstileVerifyBody(JSON.stringify({}))).toBe(false);
  });

  it("returns false for a non-boolean success value", () => {
    expect(parseTurnstileVerifyBody(JSON.stringify({ success: "true" }))).toBe(false);
  });

  it("fails closed on unparsable bodies", () => {
    expect(parseTurnstileVerifyBody("not json")).toBe(false);
    expect(parseTurnstileVerifyBody("")).toBe(false);
  });
});
