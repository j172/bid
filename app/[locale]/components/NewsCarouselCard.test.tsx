// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import NewsCarouselCard from "./NewsCarouselCard";

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
  id: 42,
  title: "翔順冠軍鴿舍最新消息",
  excerpt: "本週賽事結果公告",
  imageUrl: "/uploads/news-42.jpg",
  createdAt: "2026/9/1",
};

// Issue #252 — the card's image was a bare <img> with no navigation of its
// own; only the title and CTA button linked to the detail page. These tests
// lock in that clicking the image now reaches the same /news/[id] href as
// the title/CTA, while the manual carousel controls stay untouched.
describe("NewsCarouselCard", () => {
  it("wraps the image in a link to the same /news/[id] href as the title and CTA", () => {
    render(
      <NewsCarouselCard
        items={[baseItem]}
        activeBadge="最新消息"
        ctaLabel="閱讀更多"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    const image = screen.getByAltText(baseItem.title);
    const imageLink = image.closest("a");
    expect(imageLink).not.toBeNull();
    expect(imageLink?.getAttribute("href")).toBe("/news/42");

    const titleLink = screen.getByText(baseItem.title).closest("a");
    const ctaLink = screen.getByRole("link", { name: "閱讀更多" });
    expect(titleLink).not.toBeNull();
    expect(titleLink?.getAttribute("href")).toBe("/news/42");
    expect(ctaLink.getAttribute("href")).toBe("/news/42");
  });

  it("keeps the image's aspect-ratio, object-contain and hover classes, plus a pointer cursor", () => {
    render(
      <NewsCarouselCard
        items={[baseItem]}
        activeBadge="最新消息"
        ctaLabel="閱讀更多"
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
    const items = [
      baseItem,
      { ...baseItem, id: 43, title: "第二則消息" },
    ];
    render(
      <NewsCarouselCard
        items={items}
        activeBadge="最新消息"
        ctaLabel="閱讀更多"
        emptyStateTitle="尚無內容"
        emptyStateDesc="敬請期待"
      />,
    );

    // The "next" arrow button (from CarouselControls, aria-label wired via
    // next-intl's `t("slideNext")`, mocked above to return the key) is a
    // sibling of the image link, not nested inside it — clicking it must
    // still drive the carousel on its own.
    fireEvent.click(screen.getByRole("button", { name: "slideNext" }));

    // The image link should now point at the newly active item's detail
    // page, proving the controls still work independently of the image link
    // and are not covered/intercepted by it.
    const image = screen.getByAltText("第二則消息");
    expect(image.closest("a")?.getAttribute("href")).toBe("/news/43");
  });
});
