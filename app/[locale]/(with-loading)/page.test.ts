import zhTW from "@/messages/zh-TW.json";
import zhCN from "@/messages/zh-CN.json";
import en from "@/messages/en.json";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homepageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("homepage club award presentation", () => {
  it("uses the exact requested title in all supported locales", () => {
    const expected = "各地鴿會入賞鴿(三豐攝影)";
    expect(zhTW.home.clubAwardPigeonsTitle).toBe(expected);
    expect(zhCN.home.clubAwardPigeonsTitle).toBe(expected);
    expect(en.home.clubAwardPigeonsTitle).toBe(expected);
  });

  it("omits the Sanfong feature regardless of available data and caps albums at six", () => {
    expect(homepageSource).not.toMatch(/sanfongShowcaseItems|sanfongSectionTitle|home:pigeonShowcase:sanfong/);
    expect(homepageSource).toContain("const CLUB_AWARD_ALBUMS_LIMIT = 6");
    expect(homepageSource).toContain("listTopClubAwardAlbums(CLUB_AWARD_ALBUMS_LIMIT)");
  });
});
