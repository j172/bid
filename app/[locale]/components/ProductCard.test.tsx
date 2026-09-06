// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProductCard from "./ProductCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
});

describe("ProductCard", () => {
  it("renders active product card with badge and loft name", () => {
    render(
      <ProductCard
        id={101}
        title="翔順冠軍一號"
        description="極品賽鴿"
        typeBadgeLabel="競標商品"
        quickActionLabel="立即查看"
        viewDetailsLabel="查看詳情"
        priceText="NT$35,000"
        detailLines={["剩餘 2 天", "總出價次數 5"]}
        eager={false}
        highPriorityImage={false}
        loftName="翔順鴿舍"
      />,
    );

    expect(screen.getByText("翔順冠軍一號")).toBeTruthy();
    expect(screen.getByText("翔順鴿舍")).toBeTruthy();
    expect(screen.getByText("競標商品")).toBeTruthy();
    expect(screen.getByText("NT$35,000")).toBeTruthy();
    expect(screen.getByText("剩餘 2 天")).toBeTruthy();
    expect(screen.getByText("總出價次數 5")).toBeTruthy();

    const badge = screen.getByText("競標商品");
    expect(badge.className).toContain("bg-interactive-primary-subtle");
  });

  it("renders closed product card with neutral badge style when isClosed is true", () => {
    render(
      <ProductCard
        id={102}
        title="翔順已結標種鴿"
        description="經典血統"
        typeBadgeLabel="已結標"
        quickActionLabel="查看詳情"
        viewDetailsLabel="查看詳情"
        priceText="結標價 NT$50,000"
        detailLines={["已結束", "得標者：王**", "總出價次數 12"]}
        eager={false}
        highPriorityImage={false}
        loftName="翔順鴿舍"
        isClosed={true}
      />,
    );

    expect(screen.getByText("翔順已結標種鴿")).toBeTruthy();
    expect(screen.getByText("結標價 NT$50,000")).toBeTruthy();
    expect(screen.getByText("得標者：王**")).toBeTruthy();

    const badge = screen.getByText("已結標");
    expect(badge.className).toContain("bg-slate-200");
    expect(badge.className).toContain("text-slate-700");
  });
});
