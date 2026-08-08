// lib/webauthn.ts mixes pure functions (resolveWebauthnRp,
// isWebauthnChallengeUsable — tested directly with no mocking, same split
// lib/passwordReset.ts uses for isResetTokenValid) with raw-SQL CRUD
// (createWebauthnChallenge/consumeWebauthnChallenge), which — like
// lib/emailOtp.test.ts — mocks @/lib/db's getDb() and asserts on the SQL/
// params each function sends. queryMock is created via vi.hoisted so it
// exists before vi.mock's factory below runs. The cookie helpers
// (setWebauthnChallengeCookie/readWebauthnChallengeCookie/
// clearWebauthnChallengeCookie) aren't covered here — they're a thin
// pass-through onto next/headers' cookies(), only callable from a route
// handler/server component, and have no branching logic of their own to
// unit test.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import {
  consumeWebauthnChallenge,
  createWebauthnChallenge,
  isWebauthnChallengeUsable,
  resolveWebauthnRp,
} from "./webauthn";

beforeEach(() => {
  queryMock.mockReset();
});

describe("resolveWebauthnRp", () => {
  it("defaults to the production domain when NODE_ENV is 'production'", () => {
    expect(resolveWebauthnRp("production")).toEqual({ rpID: "j172.tw", origin: "https://j172.tw" });
  });

  it("defaults to localhost for any other NODE_ENV", () => {
    expect(resolveWebauthnRp("development")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
    expect(resolveWebauthnRp(undefined)).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
    expect(resolveWebauthnRp("test")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
  });

  it("prefers WEBAUTHN_RP_ID/WEBAUTHN_ORIGIN env overrides over either default", () => {
    const originalRpId = process.env.WEBAUTHN_RP_ID;
    const originalOrigin = process.env.WEBAUTHN_ORIGIN;
    process.env.WEBAUTHN_RP_ID = "staging.example.com";
    process.env.WEBAUTHN_ORIGIN = "https://staging.example.com";

    expect(resolveWebauthnRp("production")).toEqual({
      rpID: "staging.example.com",
      origin: "https://staging.example.com",
    });

    if (originalRpId === undefined) delete process.env.WEBAUTHN_RP_ID;
    else process.env.WEBAUTHN_RP_ID = originalRpId;
    if (originalOrigin === undefined) delete process.env.WEBAUTHN_ORIGIN;
    else process.env.WEBAUTHN_ORIGIN = originalOrigin;
  });
});

describe("isWebauthnChallengeUsable", () => {
  const now = new Date("2026-08-08T12:00:00Z");
  const baseRow = {
    challenge: "abc",
    purpose: "register" as const,
    user_id: 1,
    expires_at: new Date("2026-08-08T12:03:00Z"),
    used_at: null,
  };

  it("rejects a missing row (unknown token)", () => {
    expect(isWebauthnChallengeUsable(null, "register", now)).toBe(false);
  });

  it("rejects a row issued for a different purpose", () => {
    expect(isWebauthnChallengeUsable(baseRow, "login", now)).toBe(false);
  });

  it("rejects a row that has already been used", () => {
    expect(
      isWebauthnChallengeUsable({ ...baseRow, used_at: new Date("2026-08-08T11:59:00Z") }, "register", now),
    ).toBe(false);
  });

  it("rejects a row past its 5-minute expiry", () => {
    expect(
      isWebauthnChallengeUsable({ ...baseRow, expires_at: new Date("2026-08-08T11:59:59Z") }, "register", now),
    ).toBe(false);
  });

  it("accepts an unused, not-yet-expired row issued for the matching purpose", () => {
    expect(isWebauthnChallengeUsable(baseRow, "register", now)).toBe(true);
  });
});

describe("createWebauthnChallenge", () => {
  it("inserts a 32-byte hex token bound to the purpose/user/challenge", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const token = await createWebauthnChallenge("register", 7, "challenge-value");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO webauthn_challenges");
    expect(params[0]).toBe(token);
    expect(params[1]).toBe("challenge-value");
    expect(params[2]).toBe("register");
    expect(params[3]).toBe(7);
    expect(params[4]).toBeInstanceOf(Date);
  });

  it("allows a null userId for the usernameless login flow", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await createWebauthnChallenge("login", null, "challenge-value");
    expect(queryMock.mock.calls[0][1][3]).toBeNull();
  });

  it("generates a different token on every call", async () => {
    queryMock.mockResolvedValue([{}]);
    const a = await createWebauthnChallenge("register", 1, "c1");
    const b = await createWebauthnChallenge("register", 1, "c2");
    expect(a).not.toBe(b);
  });
});

describe("consumeWebauthnChallenge", () => {
  it("rejects an unknown token without writing anything", async () => {
    queryMock.mockResolvedValueOnce([[]]); // SELECT finds nothing
    const result = await consumeWebauthnChallenge("nope", "register");
    expect(result).toEqual({ ok: false });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a challenge issued for a different purpose", async () => {
    queryMock.mockResolvedValueOnce([
      [{ challenge: "c", purpose: "login", user_id: null, expires_at: new Date(Date.now() + 60_000), used_at: null }],
    ]);
    const result = await consumeWebauthnChallenge("token", "register");
    expect(result).toEqual({ ok: false });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-used challenge", async () => {
    queryMock.mockResolvedValueOnce([
      [{ challenge: "c", purpose: "register", user_id: 1, expires_at: new Date(Date.now() + 60_000), used_at: new Date() }],
    ]);
    const result = await consumeWebauthnChallenge("token", "register");
    expect(result).toEqual({ ok: false });
  });

  it("rejects an expired challenge", async () => {
    queryMock.mockResolvedValueOnce([
      [{ challenge: "c", purpose: "register", user_id: 1, expires_at: new Date(Date.now() - 1000), used_at: null }],
    ]);
    const result = await consumeWebauthnChallenge("token", "register");
    expect(result).toEqual({ ok: false });
  });

  it("accepts a valid challenge, marks it used, and returns the challenge/userId", async () => {
    queryMock.mockResolvedValueOnce([
      [{ challenge: "c-value", purpose: "register", user_id: 9, expires_at: new Date(Date.now() + 60_000), used_at: null }],
    ]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE used_at

    const result = await consumeWebauthnChallenge("valid-token", "register");

    expect(result).toEqual({ ok: true, challenge: "c-value", userId: 9 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("UPDATE webauthn_challenges SET used_at = NOW()");
    expect(queryMock.mock.calls[1][1]).toEqual(["valid-token"]);
  });

  it("returns a null userId for the usernameless login flow", async () => {
    queryMock.mockResolvedValueOnce([
      [{ challenge: "c-value", purpose: "login", user_id: null, expires_at: new Date(Date.now() + 60_000), used_at: null }],
    ]);
    queryMock.mockResolvedValueOnce([{}]);

    const result = await consumeWebauthnChallenge("valid-token", "login");
    expect(result).toEqual({ ok: true, challenge: "c-value", userId: null });
  });
});
