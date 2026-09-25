// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import LineSection from "./LineSection";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      lineSectionTitle: "LINE 帳號綁定",
      lineLinkedBadge: "已綁定",
      lineLinkedDescription: "已成功連結您的 LINE 帳號",
      lineUnlinkedDescription: "尚未綁定 LINE 帳號",
      linkLineButton: "立即綁定 LINE 帳號",
      unlinkLineButton: "解除 LINE 綁定",
      unlinkConfirmPrompt: "確定要解除此帳號的 LINE 綁定嗎？",
      confirmUnlinkButton: "確定解除",
      cancelButton: "取消",
      defaultError: "操作失敗",
    };
    return map[key] || key;
  },
}));

describe("LineSection", () => {
  it("renders unlinked state with bind button when initialLineLinked is false", () => {
    render(<LineSection initialLineLinked={false} />);
    expect(screen.getByText("尚未綁定 LINE 帳號")).toBeDefined();
    const link = screen.getByRole("link", { name: "立即綁定 LINE 帳號" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/api/auth/line?returnTo=/account");
  });

  it("renders linked state with badge and unlink button when initialLineLinked is true", () => {
    render(<LineSection initialLineLinked={true} />);
    expect(screen.getByText("已綁定")).toBeDefined();
    expect(screen.getByRole("button", { name: "解除 LINE 綁定" })).toBeDefined();
  });

  it("shows confirmation and unlinks upon confirm button click", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    render(<LineSection initialLineLinked={true} />);

    // Click unlink trigger
    fireEvent.click(screen.getByRole("button", { name: "解除 LINE 綁定" }));
    expect(screen.getByText("確定要解除此帳號的 LINE 綁定嗎？")).toBeDefined();

    // Click confirm unlink
    fireEvent.click(screen.getByRole("button", { name: "確定解除" }));

    await waitFor(() => {
      expect(screen.getByText("尚未綁定 LINE 帳號")).toBeDefined();
    });
  });
});
