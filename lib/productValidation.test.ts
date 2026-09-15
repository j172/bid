import { describe, expect, it } from "vitest";
import {
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_PRICE_TEXT_MAX,
  PRODUCT_TITLE_MAX,
  validateProductDescription,
  validateProductPriceText,
  validateProductSortOrder,
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

describe("validateProductPriceText", () => {
  it("accepts free-text price display, not parsed as a number", () => {
    expect(validateProductPriceText("NT$12,000")).toEqual({ ok: true });
    expect(validateProductPriceText("電洽")).toEqual({ ok: true });
  });

  it("rejects an empty price text", () => {
    expect(validateProductPriceText("").ok).toBe(false);
  });

  it("rejects price text over the max length", () => {
    expect(validateProductPriceText("a".repeat(PRODUCT_PRICE_TEXT_MAX + 1)).ok).toBe(false);
  });
});

describe("validateProductDescription", () => {
  it("accepts a normal plain-text description", () => {
    expect(validateProductDescription("這是商品簡介")).toEqual({ ok: true });
  });

  it("rejects an empty description", () => {
    expect(validateProductDescription("").ok).toBe(false);
  });

  it("rejects a description over the max length", () => {
    expect(validateProductDescription("a".repeat(PRODUCT_DESCRIPTION_MAX + 1)).ok).toBe(false);
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
