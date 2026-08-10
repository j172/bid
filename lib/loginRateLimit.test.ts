// lib/loginRateLimit.ts mixes a pure decision function (isLoginLocked,
// tested directly with no mocking) with raw-SQL helpers over login_attempts,
// which — like lib/passwordReset.test.ts — mock @/lib/db's getDb() and
// assert on the SQL/params each function sends. queryMock is created via
// vi.hoisted so it exists before vi.mock's factory below runs.
//
// The last describe block goes one step further and backs that mock with a
// tiny in-memory stand-in for the login_attempts table that honours the
// 15-minute window against a controllable clock, so the full
// "fail 5 times → locked → window elapses → back to normal" lifecycle
// issue #140 H-1 asks for is exercised end to end rather than asserted one
// canned COUNT(*) at a time.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import {
  clearLoginFailures,
  isLoginLocked,
  isLoginRateLimited,
  LOGIN_IP_MAX_FAILURES,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MINUTES,
  recordLoginFailure,
} from "./loginRateLimit";

beforeEach(() => {
  queryMock.mockReset();
});

describe("isLoginLocked", () => {
  it("is not locked below the cap", () => {
    expect(isLoginLocked(0)).toBe(false);
    expect(isLoginLocked(LOGIN_MAX_FAILURES - 1)).toBe(false);
  });

  it("locks exactly at the cap and beyond", () => {
    expect(isLoginLocked(LOGIN_MAX_FAILURES)).toBe(true);
    expect(isLoginLocked(LOGIN_MAX_FAILURES + 10)).toBe(true);
  });

  it("honours the looser per-IP cap when one is passed", () => {
    expect(isLoginLocked(LOGIN_MAX_FAILURES, LOGIN_IP_MAX_FAILURES)).toBe(false);
    expect(isLoginLocked(LOGIN_IP_MAX_FAILURES, LOGIN_IP_MAX_FAILURES)).toBe(true);
  });
});

describe("isLoginRateLimited", () => {
  it("is rate limited once this email has hit the failure cap inside the window", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: LOGIN_MAX_FAILURES }]]);
    expect(await isLoginRateLimited("Visitor@Example.com", "203.0.113.7")).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("email = ?");
    expect(queryMock.mock.calls[0][0]).toContain(`INTERVAL ${LOGIN_WINDOW_MINUTES} MINUTE`);
    // Normalized the same way lib/auth.ts's findUserByEmail normalizes before
    // its own lookup, so the counter can't be sidestepped by varying case.
    expect(queryMock.mock.calls[0][1]).toEqual(["visitor@example.com"]);
  });

  it("is rate limited once this IP has hit the looser per-IP cap", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]); // email window: clear
    queryMock.mockResolvedValueOnce([[{ cnt: LOGIN_IP_MAX_FAILURES }]]); // ip window: at the cap
    expect(await isLoginRateLimited("visitor@example.com", "203.0.113.7")).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("request_ip = ?");
    expect(queryMock.mock.calls[1][1]).toEqual(["203.0.113.7"]);
  });

  it("is not rate limited when both windows are under their caps", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: LOGIN_MAX_FAILURES - 1 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: LOGIN_IP_MAX_FAILURES - 1 }]]);
    expect(await isLoginRateLimited("visitor@example.com", "203.0.113.7")).toBe(false);
  });

  it("skips the IP check entirely when no IP is available", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isLoginRateLimited("visitor@example.com", null)).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("skips the email check for a blank email (falls through to the IP window only)", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isLoginRateLimited("", "203.0.113.7")).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("request_ip = ?");
  });
});

describe("recordLoginFailure", () => {
  it("inserts one normalized row per failed attempt", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await recordLoginFailure("  Visitor@Example.com ", "203.0.113.7");
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO login_attempts");
    expect(params).toEqual(["visitor@example.com", "203.0.113.7"]);
  });
});

describe("clearLoginFailures", () => {
  it("deletes every recorded failure for the email", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await clearLoginFailures("Visitor@Example.com");
    expect(queryMock.mock.calls[0][0]).toBe("DELETE FROM login_attempts WHERE email = ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["visitor@example.com"]);
  });
});

describe("lockout lifecycle against an in-memory login_attempts table", () => {
  const WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;
  let now = 0;
  let rows: { email: string; ip: string | null; createdAt: number }[] = [];

  beforeEach(() => {
    now = new Date("2026-08-08T12:00:00Z").getTime();
    rows = [];
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.startsWith("INSERT INTO login_attempts")) {
        rows.push({ email: params[0] as string, ip: params[1] as string | null, createdAt: now });
        return [{}];
      }
      if (sql.startsWith("DELETE FROM login_attempts")) {
        rows = rows.filter((row) => row.email !== params[0]);
        return [{}];
      }
      const key = sql.includes("email = ?") ? "email" : "ip";
      const cnt = rows.filter(
        (row) => row[key] === params[0] && row.createdAt > now - WINDOW_MS,
      ).length;
      return [[{ cnt }]];
    });
  });

  const email = "visitor@example.com";
  const ip = "203.0.113.7";

  it("leaves a normal login untouched: a few failures still let a correct password through", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i += 1) {
      expect(await isLoginRateLimited(email, ip)).toBe(false);
      await recordLoginFailure(email, ip);
    }
    // The visitor finally types it right — not blocked, and the strikes are
    // cleared so the next login starts fresh.
    expect(await isLoginRateLimited(email, ip)).toBe(false);
    await clearLoginFailures(email);
    expect(rows).toHaveLength(0);
    expect(await isLoginRateLimited(email, ip)).toBe(false);
  });

  it("locks the email out once the cap is reached", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await recordLoginFailure(email, ip);
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);
  });

  it("keeps a different email usable while one email is locked out (no collateral lockout)", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await recordLoginFailure(email, ip);
    }
    expect(await isLoginRateLimited("someone-else@example.com", ip)).toBe(false);
  });

  it("recovers on its own once the failures age out of the window", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) {
      await recordLoginFailure(email, ip);
    }
    expect(await isLoginRateLimited(email, ip)).toBe(true);

    now += WINDOW_MS - 1000; // still inside the window
    expect(await isLoginRateLimited(email, ip)).toBe(true);

    now += 2000; // now past it
    expect(await isLoginRateLimited(email, ip)).toBe(false);
  });

  it("counts credential stuffing across many different emails via the per-IP window", async () => {
    for (let i = 0; i < LOGIN_IP_MAX_FAILURES; i += 1) {
      await recordLoginFailure(`victim${i}@example.com`, ip);
    }
    // No single email is anywhere near its own cap, but the IP is.
    expect(await isLoginRateLimited("victim0@example.com", ip)).toBe(true);
    expect(await isLoginRateLimited("victim0@example.com", "198.51.100.9")).toBe(false);
  });
});
