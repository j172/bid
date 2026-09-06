// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GoogleAnalytics, {
  GA_MEASUREMENT_ID,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_EVENT,
} from "./GoogleAnalytics";

// Mock next/script to render a stub div or script element
vi.mock("next/script", () => ({
  default: ({
    id,
    src,
    dangerouslySetInnerHTML,
  }: {
    id: string;
    src?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <div
      data-testid={id}
      data-src={src}
      data-content={dangerouslySetInnerHTML?.__html}
    />
  ),
}));

describe("GoogleAnalytics Component", () => {
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
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("renders the consent script and the gtag library tag with measurement ID", () => {
    const { getByTestId } = render(<GoogleAnalytics />);

    const consentScript = getByTestId("google-analytics-consent");
    expect(consentScript).toBeTruthy();
    expect(consentScript.getAttribute("data-content")).toContain(GA_MEASUREMENT_ID);
    expect(consentScript.getAttribute("data-content")).toContain("analytics_storage");

    const tagScript = getByTestId("google-analytics-tag");
    expect(tagScript).toBeTruthy();
    expect(tagScript.getAttribute("data-src")).toContain(GA_MEASUREMENT_ID);
  });

  it("updates gtag consent to granted if already accepted in localStorage on mount", () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    const gtagMock = vi.fn();
    (window as unknown as { gtag: typeof gtagMock }).gtag = gtagMock;

    render(<GoogleAnalytics />);

    expect(gtagMock).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
  });

  it("updates gtag consent when cookieConsentChanged event fires with accepted", () => {
    const gtagMock = vi.fn();
    (window as unknown as { gtag: typeof gtagMock }).gtag = gtagMock;

    render(<GoogleAnalytics />);

    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: "accepted" }),
    );

    expect(gtagMock).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
  });

  it("updates gtag consent to denied when cookieConsentChanged event fires with rejected", () => {
    const gtagMock = vi.fn();
    (window as unknown as { gtag: typeof gtagMock }).gtag = gtagMock;

    render(<GoogleAnalytics />);

    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: "rejected" }),
    );

    expect(gtagMock).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "denied",
    });
  });
});
