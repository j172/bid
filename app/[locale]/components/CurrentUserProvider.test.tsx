// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import CurrentUserProvider, { useCurrentUser } from "./CurrentUserProvider";

afterEach(cleanup);

// Issue #354: CurrentUserProvider replaces the old server-side
// getCurrentUser()/cookies() read with a client-side GET /api/auth/me fetch,
// shared via context so every consumer (GoogleOneTap, SiteHeader's auth
// links) reads the same result instead of each doing its own request. These
// tests exercise the provider's contract directly — loading state, resolved
// user, logged-out, and the network-failure fallback — via a small consumer
// that renders the state as text.
function Probe() {
  const { user, loading } = useCurrentUser();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? `${user.email}:${user.role}` : "none"}</span>
    </div>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CurrentUserProvider", () => {
  it("starts in a loading state before the /api/auth/me response arrives", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves within this test

    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me");
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("exposes the logged-in user once /api/auth/me resolves", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, user: { id: 7, email: "pigeon@example.com", role: "user" } }),
    });

    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("pigeon@example.com:user");
  });

  it("exposes null once /api/auth/me resolves with no session", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, user: null }),
    });

    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("falls back to logged-out rather than staying stuck loading when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("falls back to logged-out on a non-OK response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("ignores a late response after unmount instead of updating unmounted state", async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    unmount();

    // Resolving after unmount must not throw/log a React "state update on
    // an unmounted component" warning — the effect's cleanup sets a
    // `cancelled` flag that the .then() checks before calling setState.
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ ok: true, user: null }) });
      await Promise.resolve();
    });
  });
});
