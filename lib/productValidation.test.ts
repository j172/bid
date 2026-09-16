import { describe, expect, it } from "vitest";
import {
  PRODUCT_DESCRIPTION_HTML_MAX,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_PRICE_MAX,
  PRODUCT_TITLE_MAX,
  validateProductDescription,
  validateProductPrice,
  validateProductPriceOrCallForPrice,
  validateProductSortOrder,
  validateProductStockQuantity,
  validateProductStockRemaining,
  validateProductTitle,
} from "./productValidation";

describe("validateProductTitle", () => {
  it("accepts a normal title", () => {
    expect(validateProductTitle("限量特惠鴿")).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(validateProductTitle("").ok).toBe(false);
    expect(validateProductTitle("   ").ok).toBe(false);
  });

  it("rejects a title over the max length", () => {
    expect(validateProductTitle("a".repeat(PRODUCT_TITLE_MAX + 1)).ok).toBe(false);
  });

  it("accepts a title at exactly the max length", () => {
    expect(validateProductTitle("a".repeat(PRODUCT_TITLE_MAX))).toEqual({ ok: true });
  });
});

describe("validateProductPrice", () => {
  it("accepts a positive number", () => {
    expect(validateProductPrice(12000)).toEqual({ ok: true });
  });

  it("rejects zero, negative, or non-finite values", () => {
    expect(validateProductPrice(0).ok).toBe(false);
    expect(validateProductPrice(-1).ok).toBe(false);
    expect(validateProductPrice(NaN).ok).toBe(false);
  });

  it("rejects a value over the max", () => {
    expect(validateProductPrice(PRODUCT_PRICE_MAX + 1).ok).toBe(false);
  });

  it("accepts a value at exactly the max", () => {
    expect(validateProductPrice(PRODUCT_PRICE_MAX)).toEqual({ ok: true });
  });
});

describe("validateProductPriceOrCallForPrice", () => {
  it("skips validation entirely when callForPrice is true, regardless of value", () => {
    expect(validateProductPriceOrCallForPrice(true, NaN)).toEqual({ ok: true });
    expect(validateProductPriceOrCallForPrice(true, -1)).toEqual({ ok: true });
  });

  it("falls through to normal price validation when callForPrice is false", () => {
    expect(validateProductPriceOrCallForPrice(false, 12000)).toEqual({ ok: true });
    expect(validateProductPriceOrCallForPrice(false, 0).ok).toBe(false);
  });
});

describe("validateProductStockQuantity", () => {
  it("skips validation when callForPrice is true", () => {
    expect(validateProductStockQuantity(NaN, true)).toEqual({ ok: true });
    expect(validateProductStockQuantity(0, true)).toEqual({ ok: true });
  });

  it("requires a positive integer when callForPrice is false", () => {
    expect(validateProductStockQuantity(5, false)).toEqual({ ok: true });
    expect(validateProductStockQuantity(0, false).ok).toBe(false);
    expect(validateProductStockQuantity(-1, false).ok).toBe(false);
    expect(validateProductStockQuantity(1.5, false).ok).toBe(false);
  });
});

describe("validateProductStockRemaining", () => {
  it("skips validation when callForPrice is true", () => {
    expect(validateProductStockRemaining(NaN, true)).toEqual({ ok: true });
  });

  it("allows exactly zero (temporarily sold out) when callForPrice is false", () => {
    expect(validateProductStockRemaining(0, false)).toEqual({ ok: true });
  });

  it("rejects a negative or non-integer value when callForPrice is false", () => {
    expect(validateProductStockRemaining(-1, false).ok).toBe(false);
    expect(validateProductStockRemaining(1.5, false).ok).toBe(false);
  });
});

describe("validateProductDescription", () => {
  it("accepts a normal plain-text description (existing rows predate rich text, issue #286)", () => {
    expect(validateProductDescription("這是商品簡介")).toEqual({ ok: true });
  });

  it("rejects an empty description", () => {
    expect(validateProductDescription("").ok).toBe(false);
  });

  it("rejects a description over the max length", () => {
    expect(validateProductDescription("a".repeat(PRODUCT_DESCRIPTION_MAX + 1)).ok).toBe(false);
  });

  it("accepts a description at exactly the max length", () => {
    expect(validateProductDescription("a".repeat(PRODUCT_DESCRIPTION_MAX))).toEqual({ ok: true });
  });

  it("measures length against visible text, not HTML markup", () => {
    const html = `<p><strong>${"a".repeat(PRODUCT_DESCRIPTION_MAX)}</strong></p>`;
    expect(validateProductDescription(html)).toEqual({ ok: true });
  });

  it("rejects an empty rich-text description (tags with no visible text)", () => {
    expect(validateProductDescription("<p><br></p>").ok).toBe(false);
  });

  it("rejects raw HTML over the safety ceiling even if visible text is short", () => {
    const html = `<p>hi</p><!--${"a".repeat(PRODUCT_DESCRIPTION_HTML_MAX)}-->`;
    expect(validateProductDescription(html).ok).toBe(false);
  });
});

describe("validateProductSortOrder", () => {
  it("accepts undefined (omitted, defaults to end-of-list)", () => {
    expect(validateProductSortOrder(undefined)).toEqual({ ok: true });
  });

  it("accepts a non-negative integer", () => {
    expect(validateProductSortOrder(0)).toEqual({ ok: true });
    expect(validateProductSortOrder(5)).toEqual({ ok: true });
  });

  it("rejects a negative number", () => {
    expect(validateProductSortOrder(-1).ok).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(validateProductSortOrder(1.5).ok).toBe(false);
  });
});
