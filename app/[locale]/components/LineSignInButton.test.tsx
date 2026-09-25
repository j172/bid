// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LineSignInButton from "./LineSignInButton";

afterEach(() => {
  cleanup();
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    if (key === "lineLoginButton") return "使用 LINE 帳號登入";
    if (key === "lineRegisterButton") return "使用 LINE 帳號註冊";
    return key;
  },
}));

describe("LineSignInButton", () => {
  it("renders with login label by default and links to /api/auth/line", () => {
    render(<LineSignInButton />);
    const link = screen.getByRole("link", { name: "使用 LINE 帳號登入" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/api/auth/line?returnTo=%2F");
  });

  it("renders with register label when mode is register and encodes returnTo", () => {
    render(<LineSignInButton mode="register" returnTo="/my-bids" />);
    const link = screen.getByRole("link", { name: "使用 LINE 帳號註冊" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/api/auth/line?returnTo=%2Fmy-bids");
  });
});
