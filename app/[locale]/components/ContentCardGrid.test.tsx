// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ContentCardGrid, { type ContentCardItem } from "./ContentCardGrid";

// ContentCardGrid's only routing dependency is the localized <Link> around
// each card, and there's no App Router context in jsdom — stubbed to a plain
// anchor, since the thumbnail rendering under test has nothing to do with
// navigation.
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

const items: ContentCardItem[] = [
  {
    id: 1,
    href: "/pigeon-showcase/1",
    imageUrl: "/uploads/pigeon-showcase/1/example.webp",
    title: "example",
    excerpt: "excerpt",
  },
];

// Regression test for issue #158: this grid is shared by the /news and
// /pigeon-showcase list pages, and the thumbnail used `object-cover` inside
// a fixed h-40 box, cropping images whose aspect ratio didn't match. It
// should show the image in full (object-contain) with a neutral fill color
// for the resulting letterbox/pillarbox space, matching the fix already
// applied to the pigeon-showcase detail page's main image in #155.
describe("ContentCardGrid thumbnail", () => {
  it("uses object-contain with a slate fill instead of cropping with object-cover", () => {
    render(<ContentCardGrid items={items} emptyLabel="empty" viewDetailsLabel="view" />);

    const img = screen.getByAltText("example") as HTMLImageElement;
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("bg-slate-100");
    expect(img.className).not.toContain("object-cover");
    // Fixed-height box is unchanged — only the fit/crop behavior changed.
    expect(img.className).toContain("h-40");
  });
});
