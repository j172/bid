// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProductGridCard from "./ProductGridCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

const baseItem = {
  id: 7,
  title: "翔順鴿舍限量商品",
  priceText: "NT$12,000",
  imageUrl: "/uploads/products/7/cover.jpg",
};

describe("ProductGridCard", () => {
  it("wraps the image and CTA in a link to that product's /products/<id> detail page", () => {
    render(<ProductGridCard item={baseItem} locale="zh-TW" ctaLabel="查看詳情" />);

    const image = screen.getByAltText(baseItem.title);
    expect(image.getAttribute("src")).toBe(baseItem.imageUrl);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/products/7");

    const ctaLink = screen.getByRole("link", { name: "查看詳情" });
    expect(ctaLink.getAttribute("href")).toBe("/products/7");

    expect(screen.getByText(baseItem.priceText).textContent).toBe(baseItem.priceText);
  });

  it("formats an all-digits priceText with the NT$ thousand-separator convention (lib/productPriceText.ts)", () => {
    render(
      <ProductGridCard item={{ ...baseItem, priceText: "12000" }} locale="zh-TW" ctaLabel="查看詳情" />,
    );

    expect(screen.getByText("NT$12,000")).toBeTruthy();
  });

  it("shows the description excerpt between the price and the CTA when present", () => {
    render(
      <ProductGridCard
        item={{ ...baseItem, excerpt: "血統優良，體型健壯，適合長距離賽事訓練使用…" }}
        locale="zh-TW"
        ctaLabel="查看詳情"
      />,
    );

    expect(screen.getByText("血統優良，體型健壯，適合長距離賽事訓練使用…").textContent).toBe(
      "血統優良，體型健壯，適合長距離賽事訓練使用…",
    );
  });

  it("renders no excerpt paragraph when the excerpt is empty or absent", () => {
    const { container } = render(
      <ProductGridCard item={{ ...baseItem, excerpt: "" }} locale="zh-TW" ctaLabel="查看詳情" />,
    );

    expect(container.querySelector(".mt-2\\.5")).toBeNull();
  });

  it("renders no badge (catalog grid context, unlike the homepage carousel card)", () => {
    render(<ProductGridCard item={baseItem} locale="zh-TW" ctaLabel="查看詳情" />);

    expect(screen.queryByText("精選商品")).toBeNull();
  });
});
