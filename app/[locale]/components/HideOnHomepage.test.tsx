// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HideOnHomepage from "./HideOnHomepage";

// Mirrors CookieConsentBanner.test.tsx's approach to stubbing
// @/i18n/navigation in jsdom (no real App Router context there) — here the
// mock's usePathname is the actual thing under test, so each test controls
// its return value directly rather than stubbing it away.
const mockUsePathname = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

afterEach(() => {
  cleanup();
  mockUsePathname.mockReset();
});

describe("HideOnHomepage", () => {
  it("renders nothing on the homepage path", () => {
    mockUsePathname.mockReturnValue("/");

    const { container } = render(
      <HideOnHomepage>
        <p>exchange rate card</p>
      </HideOnHomepage>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("exchange rate card")).toBeNull();
  });

  it("renders children on any other path", () => {
    mockUsePathname.mockReturnValue("/listings");

    render(
      <HideOnHomepage>
        <p>exchange rate card</p>
      </HideOnHomepage>,
    );

    expect(screen.getByText("exchange rate card")).toBeTruthy();
  });
});
