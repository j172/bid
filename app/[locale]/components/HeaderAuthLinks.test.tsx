// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/zh-TW.json";
import type { CurrentUser } from "./CurrentUserProvider";
import { HeaderBottomAuthLinks, HeaderDesktopAuthActions, HeaderMobileAuthLinks } from "./HeaderAuthLinks";

afterEach(cleanup);

// No App Router context in jsdom — same stub pattern as
// CookieConsentBanner.test.tsx for the localized <Link>, plus a no-op
// useRouter since LogoutButton (rendered inside HeaderDesktopAuthActions for
// a logged-in user) calls it.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// These components only ever consume useCurrentUser() — controlling its
// return value directly (rather than mocking fetch + waiting) keeps each
// test focused on "given this auth state, what renders", which is the
// behavior issue #354 actually changed (moving that state off the server
// cookies() read and onto this client hook).
const useCurrentUserMock = vi.fn();
vi.mock("./CurrentUserProvider", () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

function renderWithIntl(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      {children}
    </NextIntlClientProvider>,
  );
}

const regularUser: CurrentUser = { id: 1, email: "user@example.com", role: "user" };
const adminUser: CurrentUser = { id: 2, email: "admin@example.com", role: "admin" };

describe("HeaderMobileAuthLinks", () => {
  it("renders nothing while auth state is loading", () => {
    useCurrentUserMock.mockReturnValue({ user: null, loading: true });
    const { container } = renderWithIntl(<HeaderMobileAuthLinks />);
    expect(container.textContent).toBe("");
  });

  it("shows login/register when logged out", () => {
    useCurrentUserMock.mockReturnValue({ user: null, loading: false });
    renderWithIntl(<HeaderMobileAuthLinks />);
    expect(screen.getByText(messages.nav.login)).toBeTruthy();
    expect(screen.getByText(messages.nav.register)).toBeTruthy();
    expect(screen.queryByText(messages.nav.myBids)).toBeNull();
  });

  it("shows my-bids (but not admin) for a regular logged-in user", () => {
    useCurrentUserMock.mockReturnValue({ user: regularUser, loading: false });
    renderWithIntl(<HeaderMobileAuthLinks />);
    expect(screen.getByText(messages.nav.myBids)).toBeTruthy();
    expect(screen.queryByText(messages.nav.admin)).toBeNull();
    expect(screen.queryByText(messages.nav.login)).toBeNull();
  });

  it("shows my-bids and admin for an admin user", () => {
    useCurrentUserMock.mockReturnValue({ user: adminUser, loading: false });
    renderWithIntl(<HeaderMobileAuthLinks />);
    expect(screen.getByText(messages.nav.myBids)).toBeTruthy();
    expect(screen.getByText(messages.nav.admin)).toBeTruthy();
  });
});

describe("HeaderBottomAuthLinks", () => {
  it("renders nothing while loading or logged out", () => {
    useCurrentUserMock.mockReturnValue({ user: null, loading: true });
    const { container: loadingContainer } = renderWithIntl(<HeaderBottomAuthLinks />);
    expect(loadingContainer.textContent).toBe("");
    cleanup();

    useCurrentUserMock.mockReturnValue({ user: null, loading: false });
    const { container: loggedOutContainer } = renderWithIntl(<HeaderBottomAuthLinks />);
    expect(loggedOutContainer.textContent).toBe("");
  });

  it("shows admin only for an admin user", () => {
    useCurrentUserMock.mockReturnValue({ user: adminUser, loading: false });
    renderWithIntl(<HeaderBottomAuthLinks />);
    expect(screen.getByText(messages.nav.myBids)).toBeTruthy();
    expect(screen.getByText(messages.nav.admin)).toBeTruthy();
  });
});

describe("HeaderDesktopAuthActions", () => {
  it("shows a neutral skeleton (not login/register) while loading", () => {
    useCurrentUserMock.mockReturnValue({ user: null, loading: true });
    renderWithIntl(<HeaderDesktopAuthActions />);
    // The whole point of the skeleton is that it must not read as either
    // "logged out" or "logged in" — asserting neither label is present is
    // what guards against the flash-of-wrong-state the issue calls out.
    expect(screen.queryByText(messages.nav.login)).toBeNull();
    expect(screen.queryByText(messages.nav.register)).toBeNull();
    expect(screen.queryByText(messages.nav.logout)).toBeNull();
  });

  it("shows login/register buttons when logged out", () => {
    useCurrentUserMock.mockReturnValue({ user: null, loading: false });
    renderWithIntl(<HeaderDesktopAuthActions />);
    expect(screen.getByText(messages.nav.login)).toBeTruthy();
    expect(screen.getByText(messages.nav.register)).toBeTruthy();
  });

  it("shows the account email and logout button when logged in", () => {
    useCurrentUserMock.mockReturnValue({ user: regularUser, loading: false });
    renderWithIntl(<HeaderDesktopAuthActions />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(screen.getByText(messages.nav.logout)).toBeTruthy();
    expect(screen.queryByText(messages.nav.login)).toBeNull();
  });
});
