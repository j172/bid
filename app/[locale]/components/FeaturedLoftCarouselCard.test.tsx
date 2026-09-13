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
  linkedLoftId: 42,
  createdAt: "2026/9/1",
};

// Issue #270 — 名家專區 no longer has its own detail page; every card links
// straight to its linked loft's /listings?loft=<id> instead. Issue #252's
// original fix (the image itself is a link, not just decorative) still
// applies, just retargeted.
describe("FeaturedLoftCarouselCard", () => {
  it("wraps the image in a link to the same /listings?loft=<linkedLoftId> href as the title and CTA", () => {
    render(
      <FeaturedLoftCarouselCard
        items={[baseItem]}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/listings"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/listings?loft=42");

    const titleLink = screen.getByText(baseItem.title).closest("a");
    const ctaLink = screen.getByRole("link", { name: "閱讀更多" });
    expect(titleLink).not.toBeNull();
    expect(titleLink?.getAttribute("href")).toBe("/listings?loft=42");
    expect(ctaLink.getAttribute("href")).toBe("/listings?loft=42");

    // The unrelated "view more" link (no single-loft target makes sense for
    // "view all") must keep pointing at the caller-supplied href, not the
    // current item's own loft.
    const viewMoreLink = screen.getByRole("link", { name: "查看全部" });
    expect(viewMoreLink.getAttribute("href")).toBe("/listings");
  });

  it("keeps the image's aspect-ratio, object-contain and hover classes, plus a pointer cursor", () => {
    render(
      <FeaturedLoftCarouselCard
        items={[baseItem]}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/listings"
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
    const items = [baseItem, { ...baseItem, id: 8, linkedLoftId: 43, title: "第二家名家鴿舍" }];
    render(
      <FeaturedLoftCarouselCard
        items={items}
        activeBadge="名家專區"
        ctaLabel="閱讀更多"
        viewMoreLabel="查看全部"
        viewMoreHref="/listings"
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
    expect(image.closest("a")?.getAttribute("href")).toBe("/listings?loft=43");
  });
});
