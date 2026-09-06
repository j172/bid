// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import zhTwMessages from "@/messages/zh-TW.json";
import enMessages from "@/messages/en.json";
import GooglePreferenceButton, { GOOGLE_PREFERENCE_HREF } from "./GooglePreferenceButton";

afterEach(() => {
  cleanup();
});

describe("GooglePreferenceButton", () => {
  it("renders with correct target URL, attributes, and zh-TW translations", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <GooglePreferenceButton />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: /加入Google首選/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe(GOOGLE_PREFERENCE_HREF);
    expect(link.getAttribute("href")).toBe("https://www.google.com/preferences/source?q=xiangshuicn.cc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.classList.contains("gsButton")).toBe(true);

    const tooltip = "請點選打勾將響水拍賣設為首選來源，在 Google 上查看更多精彩標的與報導";
    expect(link.getAttribute("title")).toBe(tooltip);
    expect(link.getAttribute("aria-label")).toBe("加入Google首選");
    expect(link.getAttribute("data-tooltip")).toBe(tooltip);

    const textSpan = link.querySelector(".gsBtnText");
    expect(textSpan).toBeTruthy();
    expect(textSpan?.textContent).toBe("加入Google首選");

    const iconSvg = link.querySelector(".gsBtnIcon");
    expect(iconSvg).toBeTruthy();
  });

  it("renders with en translations when locale is en", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GooglePreferenceButton />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: /Add to Google Preferred/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe(GOOGLE_PREFERENCE_HREF);

    const tooltip = "Click check to set Xiangshui Auction as a preferred source and see more stories on Google";
    expect(link.getAttribute("title")).toBe(tooltip);
    expect(link.getAttribute("aria-label")).toBe("Add to Google Preferred");
    expect(link.getAttribute("data-tooltip")).toBe(tooltip);

    const textSpan = link.querySelector(".gsBtnText");
    expect(textSpan?.textContent).toBe("Add to Google Preferred");
  });

  it("accepts and applies custom className", () => {
    const { container } = render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <GooglePreferenceButton className="custom-test-class" />
      </NextIntlClientProvider>,
    );

    expect(container.firstChild).toHaveProperty("className");
    expect((container.firstChild as HTMLElement).className).toContain("custom-test-class");
  });
});
