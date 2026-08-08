import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./siteUrl";

describe("resolveSiteUrl", () => {
  it("falls back to the production domain when no env override is set", () => {
    expect(resolveSiteUrl({})).toBe("https://bid.j172.tw");
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://staging.example.com" })).toBe(
      "https://staging.example.com",
    );
  });

  it("strips a trailing slash from the configured URL", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://staging.example.com/" })).toBe(
      "https://staging.example.com",
    );
  });

  it("ignores a blank/whitespace-only override", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   " })).toBe("https://bid.j172.tw");
  });
});
