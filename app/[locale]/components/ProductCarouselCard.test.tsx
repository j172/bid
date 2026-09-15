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
        ctaLabel="查看詳情"
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
        ctaLabel="查看詳情"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    expect(image.getAttribute("src")).toBe(baseItem.imageUrl);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/products/7");

    const titleLink = screen.getByText(baseItem.title).closest("a");
    expect(titleLink?.getAttribute("href")).toBe("/products/7");

    const ctaLink = screen.getByRole("link", { name: "查看詳情" });
    expect(ctaLink.getAttribute("href")).toBe("/products/7");

    expect(screen.getByText(baseItem.priceText).textContent).toBe(baseItem.priceText);
  });

  it("does not let the image link swallow the manual carousel controls", () => {
    const items = [baseItem, { ...baseItem, id: 9, title: "第二件商品", priceText: "NT$5,500" }];
    render(
      <ProductCarouselCard
        items={items}
        activeBadge="精選商品"
        ctaLabel="查看詳情"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "slideNext" }));

    const image = screen.getByAltText("第二件商品");
    expect(image.closest("a")?.getAttribute("href")).toBe("/products/9");
    expect(screen.getByText("NT$5,500").textContent).toBe("NT$5,500");
  });
});
