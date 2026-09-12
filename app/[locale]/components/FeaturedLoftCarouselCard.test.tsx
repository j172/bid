// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FeaturedLoftCarouselCard from "./FeaturedLoftCarouselCard";

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
  title: "翔順名家鴿舍介紹",
  excerpt: "深耕血統三十年",
  imageUrl: "/uploads/featured-loft-7.jpg",
  createdAt: "2026/9/1",
};

// Issue #252 — same fix as NewsCarouselCard: the image was a bare <img> with
// no link of its own; only the title and CTA button linked to the detail
// page. These tests lock in that clicking the image now reaches the same
// /featured-lofts/[id] href as the title/CTA, while the manual carousel
// controls and the "view more" list-page link stay untouched.
describe("FeaturedLoftCarouselCard", () => {
  it("wraps the image in a link to the same /featured-lofts/[id] href as the title and CTA", () => {
    render(
      <FeaturedLoftCarouselCard
        items={[baseItem]}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/featured-lofts"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/featured-lofts/7");

    const titleLink = screen.getByText(baseItem.title).closest("a");
    const ctaLink = screen.getByRole("link", { name: "閱讀更多" });
    expect(titleLink).not.toBeNull();
    expect(titleLink?.getAttribute("href")).toBe("/featured-lofts/7");
    expect(ctaLink.getAttribute("href")).toBe("/featured-lofts/7");

    // The unrelated "view more" link to the /featured-lofts list page must
    // keep pointing at the list, not the current item's detail page.
    const viewMoreLink = screen.getByRole("link", { name: "查看全部" });
    expect(viewMoreLink.getAttribute("href")).toBe("/featured-lofts");
  });

  it("keeps the image's aspect-ratio, object-contain and hover classes, plus a pointer cursor", () => {
    render(
      <FeaturedLoftCarouselCard
        items={[baseItem]}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/featured-lofts"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    expect(image.className).toContain("object-contain");
    expect(image.className).toContain("group-hover:scale-105");

    const imageLink = image.closest("a");
    expect(imageLink?.className).toContain("aspect-[16/9]");
    expect(imageLink?.className).toContain("cursor-pointer");
  });

  it("does not let the image link swallow the manual carousel controls", () => {
    const items = [baseItem, { ...baseItem, id: 8, title: "第二家名家鴿舍" }];
    render(
      <FeaturedLoftCarouselCard
        items={items}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/featured-lofts"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    // The "next" arrow button (from CarouselControls, aria-label wired via
    // next-intl's `t("slideNext")`, mocked above to return the key) is a
    // sibling of the image link, not nested inside it — clicking it must
    // still drive the carousel on its own.
    fireEvent.click(screen.getByRole("button", { name: "slideNext" }));

    const image = screen.getByAltText("第二家名家鴿舍");
    expect(image.closest("a")?.getAttribute("href")).toBe("/featured-lofts/8");
  });
});
