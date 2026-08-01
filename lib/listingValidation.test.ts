import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_HTML_MAX,
  DESCRIPTION_MAX,
  ENDS_AT_MAX_DAYS,
  PRICE_MAX,
  TITLE_MAX,
  validateDescription,
  validateEndsAt,
  validatePrice,
  validateStockQuantity,
  validateStockRemaining,
  validateTitle,
} from "./listingValidation";

describe("validateTitle", () => {
  it("accepts a normal title", () => {
    expect(validateTitle("測試商品")).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(validateTitle("").ok).toBe(false);
    expect(validateTitle("   ").ok).toBe(false);
  });

  it("rejects a title over the max length", () => {
    expect(validateTitle("a".repeat(TITLE_MAX + 1)).ok).toBe(false);
  });

  it("accepts a title at exactly the max length", () => {
    expect(validateTitle("a".repeat(TITLE_MAX))).toEqual({ ok: true });
  });
});

describe("validateDescription", () => {
  it("accepts a normal description", () => {
    expect(validateDescription("這是描述")).toEqual({ ok: true });
  });

  it("rejects an empty description", () => {
    expect(validateDescription("").ok).toBe(false);
  });

  it("rejects a description over the max length", () => {
    expect(validateDescription("a".repeat(DESCRIPTION_MAX + 1)).ok).toBe(false);
  });

  it("accepts a description at exactly the max length", () => {
    expect(validateDescription("a".repeat(DESCRIPTION_MAX))).toEqual({ ok: true });
  });

  it("measures length against visible text, not HTML markup", () => {
    const html = `<p><strong>${"a".repeat(DESCRIPTION_MAX)}</strong></p>`;
    expect(validateDescription(html)).toEqual({ ok: true });
  });

  it("rejects an empty rich-text description (tags with no visible text)", () => {
    expect(validateDescription("<p><br></p>").ok).toBe(false);
  });

  it("rejects raw HTML over the safety ceiling even if visible text is short", () => {
    const html = `<p>hi</p><!--${"a".repeat(DESCRIPTION_HTML_MAX)}-->`;
    expect(validateDescription(html).ok).toBe(false);
  });
});

describe("validatePrice", () => {
  it("accepts a positive price within the max", () => {
    expect(validatePrice(1000, "價格")).toEqual({ ok: true });
  });

  it("rejects non-finite, zero, or negative prices", () => {
    expect(validatePrice(NaN, "價格").ok).toBe(false);
    expect(validatePrice(0, "價格").ok).toBe(false);
    expect(validatePrice(-1, "價格").ok).toBe(false);
  });

  it("rejects a price over the max", () => {
    expect(validatePrice(PRICE_MAX + 1, "價格").ok).toBe(false);
  });

  it("accepts a price at exactly the max", () => {
    expect(validatePrice(PRICE_MAX, "價格")).toEqual({ ok: true });
  });
});

describe("validateEndsAt", () => {
  it("accepts a valid future date within the max window", () => {
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(validateEndsAt(endsAt)).toEqual({ ok: true });
  });

  it("rejects an invalid date", () => {
    expect(validateEndsAt(new Date(NaN)).ok).toBe(false);
  });

  it("rejects a date in the past or present", () => {
    expect(validateEndsAt(new Date(Date.now() - 1000)).ok).toBe(false);
  });

  it("rejects a date beyond the max window", () => {
    const tooFar = new Date(Date.now() + (ENDS_AT_MAX_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(validateEndsAt(tooFar).ok).toBe(false);
  });

  it("accepts a date just within the max window", () => {
    const justWithin = new Date(Date.now() + ENDS_AT_MAX_DAYS * 24 * 60 * 60 * 1000 - 60_000);
    expect(validateEndsAt(justWithin)).toEqual({ ok: true });
  });
});

describe("validateStockQuantity", () => {
  it("accepts a positive integer", () => {
    expect(validateStockQuantity(10)).toEqual({ ok: true });
  });

  it("rejects non-finite, zero, negative, or non-integer values", () => {
    expect(validateStockQuantity(NaN).ok).toBe(false);
    expect(validateStockQuantity(0).ok).toBe(false);
    expect(validateStockQuantity(-1).ok).toBe(false);
    expect(validateStockQuantity(1.5).ok).toBe(false);
  });
});

describe("validateStockRemaining", () => {
  it("accepts a positive integer", () => {
    expect(validateStockRemaining(10)).toEqual({ ok: true });
  });

  it("accepts exactly zero (marks a listing temporarily sold out)", () => {
    expect(validateStockRemaining(0)).toEqual({ ok: true });
  });

  it("rejects non-finite, negative, or non-integer values", () => {
    expect(validateStockRemaining(NaN).ok).toBe(false);
    expect(validateStockRemaining(-1).ok).toBe(false);
    expect(validateStockRemaining(1.5).ok).toBe(false);
  });
});
