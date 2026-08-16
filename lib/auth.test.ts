// Issue #139 M5: suspendUser checks the target exists before acting, but
// unsuspendUser didn't — it ran its UPDATE unconditionally and reported
// { ok: true } for an id that was never there, so app/z04urru6's
// SuspendToggleButton showed a success for a row it never touched. Mocks
// @/lib/db's getDb() and asserts on the SQL/params, same style as
// lib/homepageSections.test.ts (lib/auth.ts is raw SQL, not pure logic).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import { changePassword, hashPassword, setTwoFactorMethod, unsuspendUser, verifyCurrentPassword } from "./auth";

beforeEach(() => {
  queryMock.mockReset();
});

// Real scrypt-derived hash/salt (same setup as lib/totp.test.ts's
// confirmTotpSetup tests, which exercise this same password check via
// verifyCurrentPassword) — needed because verifyCurrentPassword's own
// scrypt-based verifyPassword isn't mocked, only the DB layer is.
const PASSWORD = "correct horse battery staple";
let passwordHash: string;
let passwordSalt: string;

beforeEach(async () => {
  const { hash, salt } = await hashPassword(PASSWORD);
  passwordHash = hash;
  passwordSalt = salt;
});

describe("unsuspendUser", () => {
  it("clears suspended_at and reports success for an existing account", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 42 }]]); // existence check
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // the UPDATE

    await expect(unsuspendUser(42)).resolves.toEqual({ ok: true });

    expect(queryMock).toHaveBeenCalledTimes(2);
    const [updateSql, updateParams] = queryMock.mock.calls[1];
    expect(updateSql).toContain("UPDATE users SET suspended_at = NULL");
    expect(updateParams).toEqual([42]);
  });

  it("reports 找不到這個使用者 for an id that doesn't exist — and never runs the UPDATE", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    await expect(unsuspendUser(999)).resolves.toEqual({ ok: false, error: "找不到這個使用者" });

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("treats a soft-deleted account as not found (the existence check excludes deleted_at)", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await unsuspendUser(7);

    expect(result).toEqual({ ok: false, error: "找不到這個使用者" });
    const [selectSql, selectParams] = queryMock.mock.calls[0];
    expect(selectSql).toContain("deleted_at IS NULL");
    expect(selectParams).toEqual([7]);
  });

  it("stays symmetric with suspendUser's outcome shape", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 1 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await unsuspendUser(1);

    // Same { ok } discriminant the suspend route already branches on, so the
    // two routes can be read side by side.
    expect(result.ok).toBe(true);
    expect("error" in result).toBe(false);
  });
});

// Shared by changePassword and setTwoFactorMethod (issue #139 M7) — also
// exercised indirectly via lib/totp.test.ts's confirmTotpSetup/disableTotp
// tests, which go through this same function.
describe("verifyCurrentPassword", () => {
  it("returns true for the account's correct password", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    expect(await verifyCurrentPassword(7, PASSWORD)).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("SELECT password_hash, password_salt FROM users WHERE id = ?");
    expect(params).toEqual([7]);
  });

  it("returns false for a wrong password", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    expect(await verifyCurrentPassword(7, "wrong password")).toBe(false);
  });

  it("returns false for an id that doesn't exist", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await verifyCurrentPassword(999, PASSWORD)).toBe(false);
  });
});

describe("setTwoFactorMethod", () => {
  it("rejects a wrong current password without writing anything", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    const result = await setTwoFactorMethod(7, "wrong password", "email_otp");
    expect(result).toEqual({ ok: false, errorCode: "WRONG_OLD_PASSWORD" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("on a correct password: writes the requested two_factor_method", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]); // password check
    queryMock.mockResolvedValueOnce([{}]); // UPDATE

    const result = await setTwoFactorMethod(7, PASSWORD, "totp");

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("UPDATE users SET two_factor_method = ?");
    expect(queryMock.mock.calls[1][1]).toEqual(["totp", 7]);
  });
});

// Only the two rejection branches — the success path also touches
// next/headers' cookies() (to decide which sessions to keep), which isn't
// mocked here, same scope limit lib/webauthn.test.ts documents for its own
// cookie-touching functions.
describe("changePassword", () => {
  it("rejects a wrong current password without writing anything", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    const result = await changePassword(7, "wrong password", "newpassword1");
    expect(result).toEqual({ ok: false, errorCode: "WRONG_OLD_PASSWORD" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a too-short new password without writing anything", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    const result = await changePassword(7, PASSWORD, "short");
    expect(result).toEqual({ ok: false, errorCode: "NEW_PASSWORD_TOO_SHORT" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
