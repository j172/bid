import { describe, expect, it } from "vitest";
import {
  ALBUM_NAME_MAX,
  CLUB_AWARD_SORT_ORDER_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  isValidClubAwardSortOrder,
  parseOptionalClubAwardSortOrder,
  isPigeonShowcaseCategory,
  validateClubAwardAlbumName,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
  validatePigeonShowcasePhotoSource,
} from "./clubAwardPigeonsValidation";

describe("validateClubAwardAlbumName", () => {
  it("accepts a normal album name", () => {
    expect(validateClubAwardAlbumName("2026 春季南海賽鴿協會")).toEqual({ ok: true });
  });

  describe("club award sort order validation", () => {
    it("accepts non-negative integers and rejects fractions, negatives, and values outside the SQL INT range", () => {
      expect(isValidClubAwardSortOrder(0)).toBe(true);
      expect(isValidClubAwardSortOrder(CLUB_AWARD_SORT_ORDER_MAX)).toBe(true);
      expect(isValidClubAwardSortOrder(-1)).toBe(false);
      expect(isValidClubAwardSortOrder(1.5)).toBe(false);
      expect(isValidClubAwardSortOrder(CLUB_AWARD_SORT_ORDER_MAX + 1)).toBe(false);
    });

    it("distinguishes omitted values from invalid numeric input", () => {
      expect(parseOptionalClubAwardSortOrder(undefined)).toBeUndefined();
      expect(parseOptionalClubAwardSortOrder("0")).toBe(0);
      expect(parseOptionalClubAwardSortOrder("")).toBeNull();
      expect(parseOptionalClubAwardSortOrder("1.2")).toBeNull();
      expect(parseOptionalClubAwardSortOrder(-2)).toBeNull();
    });
  });

  it("rejects an empty or whitespace-only album name", () => {
    expect(validateClubAwardAlbumName("")).toEqual({ ok: false, error: "請輸入相簿名稱" });
    expect(validateClubAwardAlbumName("   ")).toEqual({ ok: false, error: "請輸入相簿名稱" });
  });

  it("accepts an album name at exactly ALBUM_NAME_MAX characters", () => {
    expect(validateClubAwardAlbumName("a".repeat(ALBUM_NAME_MAX))).toEqual({ ok: true });
  });

  it("rejects an album name over ALBUM_NAME_MAX characters", () => {
    expect(validateClubAwardAlbumName("a".repeat(ALBUM_NAME_MAX + 1))).toEqual({
      ok: false,
      error: `相簿名稱不能超過 ${ALBUM_NAME_MAX} 個字`,
    });
  });
});

describe("re-exported pigeon validators for club award pigeons", () => {
  it("validates category, name, description, and photo source", () => {
    expect(isPigeonShowcaseCategory("award")).toBe(true);
    expect(isPigeonShowcaseCategory("imported")).toBe(true);
    expect(isPigeonShowcaseCategory("representative")).toBe(true);
    expect(isPigeonShowcaseCategory("world_famous")).toBe(true);
    expect(isPigeonShowcaseCategory("other")).toBe(false);

    expect(validatePigeonShowcaseName("冠軍號")).toEqual({ ok: true });
    expect(validatePigeonShowcaseName("a".repeat(NAME_MAX + 1)).ok).toBe(false);

    expect(validatePigeonShowcaseDescription("<p>簡介內容</p>")).toEqual({ ok: true });
    expect(validatePigeonShowcaseDescription("a".repeat(DESCRIPTION_MAX + 1)).ok).toBe(false);

    expect(validatePigeonShowcasePhotoSource("三豐攝影")).toEqual({ ok: true });
    expect(validatePigeonShowcasePhotoSource("a".repeat(101)).ok).toBe(false);
  });
});
