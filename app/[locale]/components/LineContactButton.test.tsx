// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh-TW.json";
import LineContactButton from "./LineContactButton";
import { LINE_CONTACT_PHONE } from "@/lib/lineContact";

function renderButton() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <LineContactButton />
    </NextIntlClientProvider>,
  );
}

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LineContactButton", () => {
  it("renders a button (not a link) with the contact aria-label", () => {
    renderButton();

    const button = screen.getByRole("button", { name: messages.lineContact.ariaLabel });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("href")).toBeNull();
  });

  it("copies the LINE support phone number to the clipboard on click", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: messages.lineContact.ariaLabel }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINE_CONTACT_PHONE));
  });

  it("shows the phone number and the add-friend instruction after copying", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: messages.lineContact.ariaLabel }));

    expect(await screen.findByText(LINE_CONTACT_PHONE)).toBeTruthy();
    expect(screen.getByText(messages.lineContact.instruction)).toBeTruthy();
    expect(screen.getByText(messages.lineContact.copied)).toBeTruthy();
  });

  it("does not throw when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    renderButton();

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: messages.lineContact.ariaLabel })),
    ).not.toThrow();

    expect(await screen.findByText(LINE_CONTACT_PHONE)).toBeTruthy();
  });
});
