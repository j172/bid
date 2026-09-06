// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import MicrosoftClarity, { CLARITY_PROJECT_ID } from "./MicrosoftClarity";
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from "./GoogleAnalytics";

// Mock next/script
vi.mock("next/script", () => ({
  default: ({
    id,
    dangerouslySetInnerHTML,
  }: {
    id: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => <div data-testid={id} data-content={dangerouslySetInnerHTML?.__html} />,
}));

describe("MicrosoftClarity Component", () => {
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
    delete (window as unknown as { clarity?: unknown }).clarity;
  });

  it("renders script tag with correct project ID ye0mdxfat2", () => {
    const { getByTestId } = render(<MicrosoftClarity />);
    const scriptEl = getByTestId("microsoft-clarity");
    expect(scriptEl).toBeTruthy();
    expect(scriptEl.getAttribute("data-content")).toContain(CLARITY_PROJECT_ID);
    expect(scriptEl.getAttribute("data-content")).toContain("https://www.clarity.ms/tag/");
  });

  it("invokes clarity('consent', true) if consent was already accepted in localStorage", () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    const clarityMock = vi.fn();
    (window as unknown as { clarity: typeof clarityMock }).clarity = clarityMock;

    render(<MicrosoftClarity />);

    expect(clarityMock).toHaveBeenCalledWith("consent", true);
  });

  it("invokes clarity('consent', false) if consent was not accepted in localStorage", () => {
    const clarityMock = vi.fn();
    (window as unknown as { clarity: typeof clarityMock }).clarity = clarityMock;

    render(<MicrosoftClarity />);

    expect(clarityMock).toHaveBeenCalledWith("consent", false);
  });

  it("updates clarity consent state when cookieConsentChanged event is dispatched", () => {
    const clarityMock = vi.fn();
    (window as unknown as { clarity: typeof clarityMock }).clarity = clarityMock;

    render(<MicrosoftClarity />);

    // User accepts
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: "accepted" }));
    expect(clarityMock).toHaveBeenCalledWith("consent", true);

    // User rejects
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: "rejected" }));
    expect(clarityMock).toHaveBeenCalledWith("consent", false);
  });
});
