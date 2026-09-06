import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots.ts", () => {
  it("declares both main sitemap and news sitemap", () => {
    const config = robots();
    expect(Array.isArray(config.sitemap)).toBe(true);
    expect(config.sitemap).toContain("https://xiangshuicn.cc/sitemap.xml");
    expect(config.sitemap).toContain("https://xiangshuicn.cc/news-sitemap.xml");
    expect(config.host).toBe("https://xiangshuicn.cc");
  });
});
