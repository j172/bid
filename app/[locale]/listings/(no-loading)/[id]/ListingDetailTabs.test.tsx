// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ListingDetailTabs from "./ListingDetailTabs";

// Issue #336: the "additional"/"activity" tab labels and headings must be
// swappable copy (auction-flavored vs. general-product-flavored) supplied by
// the caller (app/[locale]/listings/(no-loading)/[id]/page.tsx switches on
// `isFixedPrice`) — this component itself must stay a plain, type-agnostic
// renderer of whatever labels/titles it is given.

// Same mocking pattern as CategoryDropdown.test.tsx: "@/i18n/navigation"
// wraps next/navigation, which Vitest's ESM resolver can't load directly.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderTabs(overrides: Partial<Parameters<typeof ListingDetailTabs>[0]> = {}) {
  return render(
    <ListingDetailTabs
      descriptionLabel="商品說明"
      additionalLabel="競標資訊"
      activityLabel="出價動態"
      descriptionTitle="商品描述"
      additionalTitle="競標與商品資訊"
      activityTitle="出價與交易動態"
      description="<p>desc</p>"
      youtubeUrl={null}
      listingTitle="測試商品"
      specs={[{ label: "價格", value: "NT$100" }]}
      activityTotalCountLabel="此商品共有 3 次出價"
      activityLines={[]}
      activityEmptyLabel="目前尚無出價紀錄"
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ListingDetailTabs", () => {
  it("renders the auction-flavored labels and heading it is given", () => {
    renderTabs();

    expect(screen.getByRole("button", { name: "競標資訊" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "出價動態" })).toBeTruthy();
    expect(screen.queryByText("商品資訊")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "競標資訊" }));
    expect(screen.getByText("競標與商品資訊")).toBeTruthy();
  });

  it("renders general-product-flavored labels and heading when given those instead, with no auction wording", () => {
    renderTabs({
      additionalLabel: "商品資訊",
      activityLabel: "交易動態",
      additionalTitle: "商品詳情",
      activityTitle: "交易動態",
      activityTotalCountLabel: "此商品共有 3 筆交易",
      activityEmptyLabel: "目前尚無交易紀錄",
    });

    expect(screen.getByRole("button", { name: "商品資訊" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "交易動態" })).toBeTruthy();
    expect(screen.queryByText("競標資訊")).toBeNull();
    expect(screen.queryByText("出價動態")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "商品資訊" }));
    expect(screen.getByText("商品詳情")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "交易動態" }));
    expect(screen.getByText("此商品共有 3 筆交易")).toBeTruthy();
  });

  it("keeps the specs content (price, stock, etc.) unchanged regardless of which additional-tab copy is used", () => {
    renderTabs({ additionalLabel: "商品資訊", additionalTitle: "商品詳情" });

    fireEvent.click(screen.getByRole("button", { name: "商品資訊" }));
    expect(screen.getByText("價格")).toBeTruthy();
    expect(screen.getByText("NT$100")).toBeTruthy();
  });
});
