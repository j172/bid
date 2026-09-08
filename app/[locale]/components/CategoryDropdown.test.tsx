// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import zhTwMessages from "@/messages/zh-TW.json";
import enMessages from "@/messages/en.json";
import CategoryDropdown from "./CategoryDropdown";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
});

describe("CategoryDropdown", () => {
  const mockLofts = [
    { id: 1, title: "翔水鴿舍" },
    { id: 2, title: "荷蘭名舍" },
  ];

  it("renders closed by default with aria attributes and label", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <CategoryDropdown partnerLofts={mockLofts} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-haspopup")).toBe("true");
    expect(screen.queryByRole("region", { name: /所有分類/i })).toBeNull();
  });

  it("opens popover on button click, displaying 3 columns and links", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <CategoryDropdown partnerLofts={mockLofts} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");

    const popover = screen.getByRole("region", { name: /所有分類/i });
    expect(popover).toBeTruthy();

    // Column 1: 交易專區
    expect(screen.getByText("交易專區")).toBeTruthy();
    const auctionLink = screen.getByRole("link", { name: /競標拍賣/i });
    expect(auctionLink.getAttribute("href")).toBe("/listings?type=auction");
    const fixedPriceLink = screen.getByRole("link", { name: /定價種鴿/i });
    expect(fixedPriceLink.getAttribute("href")).toBe("/listings?type=fixed_price");
    const endingSoonLink = screen.getByRole("link", { name: /即將結標/i });
    expect(endingSoonLink.getAttribute("href")).toBe("/listings?type=auction&sort=ends_soon&withinHours=6");

    // Column 2: 舍內名鴿名鑑
    expect(screen.getByText("舍內名鴿名鑑")).toBeTruthy();
    const awardLink = screen.getByRole("link", { name: /入賞鴿名鑑/i });
    expect(awardLink.getAttribute("href")).toBe("/pigeon-showcase?category=award");

    // Column 3: 精選合作鴿舍
    expect(screen.getByText("精選合作鴿舍")).toBeTruthy();
    expect(screen.getByRole("link", { name: /翔水鴿舍/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /荷蘭名舍/i })).toBeTruthy();
  });

  it("closes popover when Escape key is pressed", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <CategoryDropdown partnerLofts={mockLofts} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: /所有分類/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /所有分類/i })).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes popover when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
          <CategoryDropdown partnerLofts={mockLofts} />
        </NextIntlClientProvider>
      </div>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    fireEvent.click(button);
    expect(screen.getByRole("region", { name: /所有分類/i })).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("region", { name: /所有分類/i })).toBeNull();
  });

  it("closes popover when clicking an item link", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <CategoryDropdown partnerLofts={mockLofts} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    fireEvent.click(button);
    const auctionLink = screen.getByRole("link", { name: /競標拍賣/i });
    fireEvent.click(auctionLink);

    expect(screen.queryByRole("region", { name: /所有分類/i })).toBeNull();
  });

  it("renders graceful empty state when partner lofts list is empty", () => {
    render(
      <NextIntlClientProvider locale="zh-TW" messages={zhTwMessages}>
        <CategoryDropdown partnerLofts={[]} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /所有分類/i });
    fireEvent.click(button);

    expect(screen.getByText("目前尚無合作名舍資料")).toBeTruthy();
    expect(screen.getByRole("link", { name: /瀏覽全部合作鴿舍/i })).toBeTruthy();
  });

  it("renders with en translations when locale is en", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CategoryDropdown partnerLofts={mockLofts} />
      </NextIntlClientProvider>,
    );

    const button = screen.getByRole("button", { name: /All Categories/i });
    expect(button).toBeTruthy();
    fireEvent.click(button);

    expect(screen.getByText("Trading & Auctions")).toBeTruthy();
    expect(screen.getByText("Pigeon Showcase")).toBeTruthy();
    expect(screen.getByText("Partner Lofts")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Live Auctions/i })).toBeTruthy();
  });
});
