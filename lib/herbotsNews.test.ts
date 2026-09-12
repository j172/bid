// Only toSummary is pure logic worth a focused test — everything else in
// lib/herbotsNews.ts is thin Playwright I/O wiring (no test, same precedent
// as lib/httpsRequest.ts having none).
import { describe, expect, it } from "vitest";
import { toSummary, type RawNewsListItem } from "./herbotsNews";

const BASE: RawNewsListItem = {
  id: 10056,
  title: "Loft Verstraete Pigeons (Wielsbeke) wins 1st Provincial Chateauroux.",
  mainImage: "https://s3.herbots.be/herbots-platform/articles/Fotoliefhebbermetduif_0.jpeg",
  publishOn: 1788878580,
  translated_slugs: [
    { path: "/en/article/loft-verstraete-pigeons-wielsbeke-wins-1st-1", lang: "en" },
    { path: "/nl/artikel/loft-verstraete-pigeons-wielsbeke-wint-1e-1", lang: "nl" },
  ],
};

describe("toSummary", () => {
  it("maps a well-formed list item to an article summary with an absolute source URL", () => {
    expect(toSummary(BASE)).toEqual({
      id: 10056,
      title: BASE.title,
      mainImage: BASE.mainImage,
      publishOn: 1788878580,
      sourceUrl: "https://www.herbots.be/en/article/loft-verstraete-pigeons-wielsbeke-wins-1st-1",
    });
  });

  it("returns null when the article has no title (e.g. a Dutch-only in-memoriam notice)", () => {
    expect(toSummary({ ...BASE, title: null, mainImage: null })).toBeNull();
  });

  it("returns null when the English slug is the herbots.be 'no-slug' placeholder", () => {
    expect(
      toSummary({
        ...BASE,
        translated_slugs: [{ path: "/en/article/no-slug", lang: "en" }],
      }),
    ).toBeNull();
  });

  it("returns null when there is no English translated_slugs entry at all", () => {
    expect(
      toSummary({
        ...BASE,
        translated_slugs: [{ path: "/nl/artikel/loft-verstraete-pigeons-wielsbeke-wint-1e-1", lang: "nl" }],
      }),
    ).toBeNull();
  });

  it("passes through a null mainImage untouched (article with no cover photo)", () => {
    expect(toSummary({ ...BASE, mainImage: null })?.mainImage).toBeNull();
  });
});
