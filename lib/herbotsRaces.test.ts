// Only toRaceSummary is pure logic worth a focused test — everything else in
// lib/herbotsRaces.ts is thin Playwright I/O wiring (no test), same
// precedent as lib/herbotsNews.test.ts covering only toSummary.
import { describe, expect, it } from "vitest";
import { toRaceSummary } from "./herbotsRaces";

const BASE = {
  id: 1183,
  title: "Issoudun",
  translated_slugs: [
    { path: "/en/race/2026/issoudun-8/yearling-old", lang: "en" },
    { path: "/nl/vlucht/2026/issoudun-8/yearling-old", lang: "nl" },
  ],
  basketing_time: 1788991200,
  release_time: 1789164000,
  winner: "",
  category: "Yearling & Old",
  level: "National",
  image: null,
};

describe("toRaceSummary", () => {
  it("maps a well-formed race to a summary with an absolute source URL", () => {
    expect(toRaceSummary(BASE, "current")).toEqual({
      id: 1183,
      status: "current",
      place: "Issoudun",
      category: "Yearling & Old",
      level: "National",
      basketingTime: 1788991200,
      releaseTime: 1789164000,
      winner: "",
      image: null,
      sourceUrl: "https://www.herbots.be/en/race/2026/issoudun-8/yearling-old",
    });
  });

  it("carries the winner and image through for a finished race", () => {
    const finished = {
      ...BASE,
      winner: "PEETERS - VAN CROMBRUGGEN",
      image: "https://s3.herbots.be/herbots-platform/articles/PeetersVancrombruggen_2026.jpeg",
    };
    const summary = toRaceSummary(finished, "finished");
    expect(summary?.winner).toBe("PEETERS - VAN CROMBRUGGEN");
    expect(summary?.image).toBe("https://s3.herbots.be/herbots-platform/articles/PeetersVancrombruggen_2026.jpeg");
    expect(summary?.status).toBe("finished");
  });

  it("returns null when the race has no title", () => {
    expect(toRaceSummary({ ...BASE, title: null }, "current")).toBeNull();
  });

  it("returns null when there is no English translated_slugs entry", () => {
    expect(
      toRaceSummary(
        { ...BASE, translated_slugs: [{ path: "/nl/vlucht/2026/issoudun-8/yearling-old", lang: "nl" }] },
        "current",
      ),
    ).toBeNull();
  });
});
