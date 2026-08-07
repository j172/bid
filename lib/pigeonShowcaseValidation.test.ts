import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_HTML_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
} from "./pigeonShowcaseValidation";

describe("isPigeonShowcaseCategory", () => {
  it("accepts award and imported", () => {
    expect(isPigeonShowcaseCategory("award")).toBe(true);
    expect(isPigeonShowcaseCategory("imported")).toBe(true);
  });

  it("rejects anything else, including old pigeon_gallery-style category strings", () => {
    expect(isPigeonShowcaseCategory("custom")).toBe(false);
    expect(isPigeonShowcaseCategory("")).toBe(false);
    expect(isPigeonShowcaseCategory(undefined)).toBe(false);
    expect(isPigeonShowcaseCategory(123)).toBe(false);
  });
});

describe("validatePigeonShowcaseName", () => {
  it("accepts a normal name", () => {
    expect(validatePigeonShowcaseName("石君01")).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validatePigeonShowcaseName("").ok).toBe(false);
    expect(validatePigeonShowcaseName("   ").ok).toBe(false);
  });

  it("rejects a name over the max length", () => {
    expect(validatePigeonShowcaseName("a".repeat(NAME_MAX + 1)).ok).toBe(false);
  });

  it("accepts a name at exactly the max length", () => {
    expect(validatePigeonShowcaseName("a".repeat(NAME_MAX))).toEqual({ ok: true });
  });
});

describe("validatePigeonShowcaseDescription", () => {
  it("accepts a normal description", () => {
    expect(validatePigeonShowcaseDescription("<p>血統優良</p>")).toEqual({ ok: true });
  });

  it("rejects an empty description", () => {
    expect(validatePigeonShowcaseDescription("").ok).toBe(false);
  });

  it("rejects markup-only content with no visible text", () => {
    expect(validatePigeonShowcaseDescription("<p><br></p>").ok).toBe(false);
  });

  it("measures against plain text, not raw HTML length", () => {
    const html = `<p>${"a".repeat(DESCRIPTION_MAX)}</p>`;
    expect(validatePigeonShowcaseDescription(html)).toEqual({ ok: true });
  });

  it("rejects plain text over DESCRIPTION_MAX", () => {
    expect(validatePigeonShowcaseDescription("a".repeat(DESCRIPTION_MAX + 1)).ok).toBe(false);
  });

  it("rejects raw HTML over DESCRIPTION_HTML_MAX even if plain text is short", () => {
    const html = `<p style="${"x".repeat(DESCRIPTION_HTML_MAX)}">A</p>`;
    expect(validatePigeonShowcaseDescription(html)).toEqual({ ok: false, error: "簡介內容過長" });
  });
});
