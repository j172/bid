import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");

describe("homepage exchange-rate layout contract", () => {
  it("keeps the exchange-rate card below category browsing", () => {
    const categoryHeadingIndex = pageSource.indexOf('{t("browseByCategory")}');
    const exchangeRateIndex = pageSource.indexOf("<ExchangeRateStrip />");

    expect(categoryHeadingIndex).toBeGreaterThan(-1);
    expect(exchangeRateIndex).toBeGreaterThan(categoryHeadingIndex);
    expect(pageSource.slice(categoryHeadingIndex, exchangeRateIndex)).toContain(
      'className="mx-auto mt-6 max-w-6xl px-4 sm:px-6"',
    );
  });

  it("does not render the exchange-rate card in the top showcase grid", () => {
    const topShowcaseStart = pageSource.indexOf('<section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">');
    const heroStart = pageSource.indexOf("<HeroSection");

    expect(topShowcaseStart).toBeGreaterThan(-1);
    expect(heroStart).toBeGreaterThan(topShowcaseStart);
    expect(pageSource.slice(topShowcaseStart, heroStart)).not.toContain("ExchangeRateStrip");
  });
});