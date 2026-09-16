// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ProductCarouselCard from "./ProductCarouselCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "zh-TW",
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

describe("ProductCarouselCard", () => {
  it("shows an empty state instead of a blank block when there are no active products", () => {
    render(
      <ProductCarouselCard
        items={[]}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="目前尚無上架商品，請稍後再回來查看。"
      />,
    );

    expect(screen.getByText("尚無內容").textContent).toBe("尚無內容");
    expect(screen.getByText("目前尚無上架商品，請稍後再回來查看。").textContent).toBe(
      "目前尚無上架商品，請稍後再回來查看。",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("wraps the image, title and CTA in a link to that product's /products/<id> detail page", () => {
    render(
      <ProductCarouselCard
        items={[baseItem]}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    expect(image.getAttribute("src")).toBe(baseItem.imageUrl);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/products/7");

    // Title is now plain text (not a link) — the image+badge link above
    // already covers that role.
    expect(screen.getByText(baseItem.title).closest("a")).toBeNull();

    const ctaLink = screen.getByRole("link", { name: "立即購買" });
    expect(ctaLink.getAttribute("href")).toBe("/products/7");

    expect(screen.getByText(baseItem.priceText).textContent).toBe(baseItem.priceText);
  });

  it("renders a secondary '查看更多' link to the /products catalog page, separate from the per-item CTA", () => {
    render(
      <ProductCarouselCard
        items={[baseItem]}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const viewMoreLink = screen.getByRole("link", { name: "查看更多" });
    expect(viewMoreLink.getAttribute("href")).toBe("/products");
    // Distinct from the per-item CTA, which still points at the item's own detail page.
    const ctaLink = screen.getByRole("link", { name: "立即購買" });
    expect(ctaLink.getAttribute("href")).toBe("/products/7");
  });

  it("does not let the image link swallow the manual carousel controls", () => {
    const items = [baseItem, { ...baseItem, id: 9, title: "第二件商品", priceText: "NT$5,500" }];
    render(
      <ProductCarouselCard
        items={items}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "slideNext" }));

    const image = screen.getByAltText("第二件商品");
    expect(image.closest("a")?.getAttribute("href")).toBe("/products/9");
    expect(screen.getByText("NT$5,500").textContent).toBe("NT$5,500");
  });

  it("shows the description excerpt between the price and the CTA when present", () => {
    render(
      <ProductCarouselCard
        items={[{ ...baseItem, excerpt: "血統優良，體型健壯，適合長距離賽事訓練使用…" }]}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    expect(screen.getByText("血統優良，體型健壯，適合長距離賽事訓練使用…").textContent).toBe(
      "血統優良，體型健壯，適合長距離賽事訓練使用…",
    );
  });

  it("renders no excerpt paragraph when the excerpt is empty or absent", () => {
    const { container } = render(
      <ProductCarouselCard
        items={[{ ...baseItem, excerpt: "" }]}
        activeBadge="精選商品"
        ctaLabel="立即購買"
        viewMoreLabel="查看更多"
        viewMoreHref="/products"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    expect(container.querySelector(".mt-2\\.5")).toBeNull();
  });
});
