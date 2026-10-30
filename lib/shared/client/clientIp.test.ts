import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders } from "./clientIp";

describe("getClientIpFromHeaders", () => {
  it("returns the forwarded IP", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("takes the left-most entry of a comma-separated chain", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("returns null when the header is missing", () => {
    expect(getClientIpFromHeaders(new Headers())).toBeNull();
  });

  it("returns null when the header is present but blank", () => {
    const headers = new Headers({ "x-forwarded-for": "   " });
    expect(getClientIpFromHeaders(headers)).toBeNull();
  });
});
