// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh-TW.json";
import LineContactButton from "./LineContactButton";
import { LINE_CONTACT_HREF } from "@/lib/lineContact";

function renderButton() {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      <LineContactButton />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("LineContactButton", () => {
  it("links to the LINE add-friend page and opens it in a new tab", () => {
    renderButton();

    const link = screen.getByRole("link", { name: messages.lineContact.ariaLabel });

    expect(link.getAttribute("href")).toBe(LINE_CONTACT_HREF);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
