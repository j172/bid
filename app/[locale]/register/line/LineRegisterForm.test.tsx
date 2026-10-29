// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import LineRegisterForm from "./LineRegisterForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("next-intl", () => ({
  useLocale: () => "zh-TW",
  useTranslations: (ns: string) => (key: string, params?: Record<string, string>) => {
    if (ns === "lineRegister") {
      if (key === "expiredTitle") return "LINE 授權階段已過期";
      if (key === "retryButton") return "重新登入";
      if (key === "title") return "完善會員資料";
      if (key === "linkingNotice") return `電子郵件「${params?.email}」已註冊`;
      if (key === "linkingButton") return "驗證密碼並綁定 LINE";
      if (key === "submitButton") return "完成註冊並登入";
    }
    if (ns === "register") {
      if (key === "displayName") return "顯示名稱";
      if (key === "email") return "Email";
      if (key === "phone") return "聯絡電話";
      if (key === "termsPrefix") return "我已閱讀並同意";
      if (key === "auctionTermsLink") return "拍賣規則";
      if (key === "termsAnd") return "與";
      if (key === "privacyLink") return "隱私權政策";
    }
    return key;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("LineRegisterForm", () => {
  it("renders expired view when onboard info request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false }),
    });

    render(<LineRegisterForm />);

    await waitFor(() => {
      expect(screen.getByText("LINE 授權階段已過期")).toBeDefined();
      expect(screen.getByRole("link", { name: "重新登入" })).toBeDefined();
    });
  });

  it("renders registration form with prefilled name and email when new user", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          displayName: "Line Brown",
          email: "brown@example.com",
          picture: null,
          emailExists: false,
        },
      }),
    });

    render(<LineRegisterForm />);

    await waitFor(() => {
      expect(screen.getByText("完善會員資料")).toBeDefined();
      const nameInput = screen.getByDisplayValue("Line Brown") as HTMLInputElement;
      expect(nameInput).toBeDefined();
      const emailInput = screen.getByDisplayValue("brown@example.com") as HTMLInputElement;
      expect(emailInput).toBeDefined();
      expect(screen.getByRole("button", { name: "完成註冊並登入" })).toBeDefined();
    });
  });

  it("renders account linking prompt when email already exists", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          displayName: "Existing User",
          email: "existing@example.com",
          picture: null,
          emailExists: true,
        },
      }),
    });

    render(<LineRegisterForm />);

    await waitFor(() => {
      expect(screen.getByText("電子郵件「existing@example.com」已註冊")).toBeDefined();
      expect(screen.getByRole("button", { name: "驗證密碼並綁定 LINE" })).toBeDefined();
    });
  });
});
