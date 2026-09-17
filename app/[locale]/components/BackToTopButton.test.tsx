// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh-TW.json";
import BackToTopButton from "./BackToTopButton";

function renderButton() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <BackToTopButton />
    </NextIntlClientProvider>,
  );
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  fireEvent.scroll(window);
}

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollToSpy = vi.fn();
  vi.stubGlobal("scrollTo", scrollToSpy);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("BackToTopButton", () => {
  it("stays hidden from assistive tech until the page is scrolled past the threshold", () => {
    renderButton();

    // aria-hidden="true" both removes the element from the default
    // accessibility tree and blanks its computed accessible name, so it has
    // to be looked up by its title rather than by role here.
    const button = screen.getByTitle(messages.backToTop.ariaLabel);
    expect(button.getAttribute("aria-hidden")).toBe("true");
    expect(button.getAttribute("tabindex")).toBe("-1");
  });

  it("becomes visible once scrolled past the threshold", () => {
    renderButton();

    scrollTo(1200);

    const button = screen.getByRole("button", { name: messages.backToTop.ariaLabel });
    expect(button.getAttribute("aria-hidden")).toBe("false");
    expect(button.getAttribute("tabindex")).toBe("0");
  });

  it("hides again if the page is scrolled back up", () => {
    renderButton();

    scrollTo(1200);
    scrollTo(0);

    const button = screen.getByTitle(messages.backToTop.ariaLabel);
    expect(button.getAttribute("aria-hidden")).toBe("true");
  });

  it("smooth-scrolls to the top on click", () => {
    renderButton();

    scrollTo(1200);
    fireEvent.click(screen.getByRole("button", { name: messages.backToTop.ariaLabel }));

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
