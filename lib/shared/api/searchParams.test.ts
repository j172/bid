import { describe, expect, it } from "vitest";
import { buildQuery, firstParam, numberParam } from "./searchParams";

describe("firstParam", () => {
  it("returns a plain value unchanged", () => {
    expect(firstParam("hello")).toBe("hello");
  });

  it("takes the first of a repeated param", () => {
    expect(firstParam(["a", "b"])).toBe("a");
  });

  it("passes absence through", () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});

describe("numberParam", () => {
  it("parses a numeric param", () => {
    expect(numberParam("42")).toBe(42);
    expect(numberParam(["7", "8"])).toBe(7);
  });

  it("returns undefined for absent or unparseable values", () => {
    expect(numberParam(undefined)).toBeUndefined();
    expect(numberParam("")).toBeUndefined();
    expect(numberParam("abc")).toBeUndefined();
  });
});

describe("buildQuery", () => {
  it("carries the listed keys through from the current params", () => {
    expect(buildQuery({ search: "鴿", page: "2" }, ["search", "pageSize", "page"])).toBe("search=%E9%B4%BF&page=2");
  });

  it("lets overrides replace a carried value", () => {
    expect(buildQuery({ search: "鴿", page: "3" }, ["search", "page"], { page: "1" })).toBe("search=%E9%B4%BF&page=1");
  });

  it("drops empty values so a bare path stays bare", () => {
    expect(buildQuery({}, ["search", "page"])).toBe("");
    expect(buildQuery({ search: "" }, ["search"])).toBe("");
  });

  it("ignores params not in the key list", () => {
    expect(buildQuery({ search: "a", evil: "b" }, ["search"])).toBe("search=a");
  });

  it("emits keys in the declared order regardless of the input object's order", () => {
    expect(buildQuery({ page: "2", search: "a" }, ["search", "page"])).toBe("search=a&page=2");
  });
});
