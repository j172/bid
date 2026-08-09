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

import { unsuspendUser } from "./auth";

beforeEach(() => {
  queryMock.mockReset();
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
