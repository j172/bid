// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InAppBrowserBanner, { INAPP_DISMISSED_STORAGE_KEY } from "./InAppBrowserBanner";

afterEach(cleanup);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      ariaLabel: "External browser recommendation notice",
      badge: "Open in External Browser",
      message: "In-app browser detected.",
      iosGuide: "Tap share and open in Safari",
      androidGuide: "Tap menu and open in Chrome",
      copyLink: "Copy Link",
      copied: "Link Copied!",
      dismiss: "Dismiss",
    };
    return messages[key] ?? key;
  },
}));

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
});

describe("InAppBrowserBanner", () => {
  it("does not render on regular browser userAgent", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    );
    const { container } = render(<InAppBrowserBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with iOS guide when opened inside LINE on iOS", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/13.8.1",
    );
    render(<InAppBrowserBanner />);
    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText("Tap share and open in Safari")).toBeTruthy();
    expect(screen.getByText("Copy Link")).toBeTruthy();
  });

  it("renders with Android guide when opened inside Facebook on Android", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/420.0.0.32.62;]",
    );
    render(<InAppBrowserBanner />);
    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText("Tap menu and open in Chrome")).toBeTruthy();
  });

  it("dismisses banner and sets sessionStorage when dismiss button clicked", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) Mobile/15E148 Safari Line/13.8.1",
    );
    render(<InAppBrowserBanner />);
    const dismissBtn = screen.getByLabelText("Dismiss");
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole("region")).toBeNull();
    expect(window.sessionStorage.getItem(INAPP_DISMISSED_STORAGE_KEY)).toBe("1");
  });

  it("does not render if previously dismissed in session", () => {
    window.sessionStorage.setItem(INAPP_DISMISSED_STORAGE_KEY, "1");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) Mobile/15E148 Safari Line/13.8.1",
    );
    const { container } = render(<InAppBrowserBanner />);
    expect(container.firstChild).toBeNull();
  });
});
