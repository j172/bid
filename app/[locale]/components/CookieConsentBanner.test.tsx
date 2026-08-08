// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh-TW.json";
import CookieConsentBanner from "./CookieConsentBanner";

// The banner's only routing dependency is the localized <Link> to the GDPR
// page, and there's no App Router context in jsdom — stubbed to a plain
// anchor, since the consent behavior under test has nothing to do with
// navigation.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <CookieConsentBanner />
    </NextIntlClientProvider>,
  );
}

// This jsdom setup exposes no usable window.localStorage (Node's own
// experimental localStorage global shadows jsdom's and is unavailable without
// --localstorage-file), so the banner's one browser dependency is stubbed with
// a plain in-memory Storage — same approach as ZoomableProductImage.test.tsx's
// matchMedia stub.
beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
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
    } satisfies Storage,
  });
});

afterEach(() => {
  cleanup();
});

describe("CookieConsentBanner", () => {
  it("shows on a first visit, with both choices offered", () => {
    renderBanner();

    expect(screen.getByRole("region", { name: messages.cookieBanner.ariaLabel })).toBeTruthy();
    expect(screen.getByRole("button", { name: messages.cookieBanner.accept })).toBeTruthy();
    expect(screen.getByRole("button", { name: messages.cookieBanner.reject })).toBeTruthy();
  });

  it("records an accept and dismisses itself", () => {
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: messages.cookieBanner.accept }));

    expect(window.localStorage.getItem("cookieConsent")).toBe("accepted");
    expect(screen.queryByRole("region", { name: messages.cookieBanner.ariaLabel })).toBeNull();
  });

  // "Reject" has no functional effect today (there are no non-essential
  // cookies to switch off), but the choice must still be persisted so a
  // future integration can honor it rather than re-ask.
  it("records a rejection and dismisses itself", () => {
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: messages.cookieBanner.reject }));

    expect(window.localStorage.getItem("cookieConsent")).toBe("rejected");
    expect(screen.queryByRole("region", { name: messages.cookieBanner.ariaLabel })).toBeNull();
  });

  it("stays hidden once a choice has been stored", () => {
    window.localStorage.setItem("cookieConsent", "rejected");

    renderBanner();

    expect(screen.queryByRole("region", { name: messages.cookieBanner.ariaLabel })).toBeNull();
  });
});
