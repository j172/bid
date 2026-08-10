import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBuyerProfileForOrder,
  getWinnerProfileForListing,
  markListingSettled,
  markOrderSettled,
  unsettleListing,
  unsettleOrder,
  validateSettlement,
} from "./settlement";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue([[]]);
});

/** The SQL of the single query the call under test issued, whitespace-normalized. */
function sentSql(): string {
  expect(queryMock).toHaveBeenCalledTimes(1);
  return String(queryMock.mock.calls[0][0]).replace(/\s+/g, " ").trim();
}

function sentParams(): unknown[] {
  return queryMock.mock.calls[0][1] as unknown[];
}

const valid = { account: "0912345678", amount: 5000 };

describe("validateSettlement", () => {
  it("accepts a well-formed settlement", () => {
    expect(validateSettlement(valid)).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only account", () => {
    expect(validateSettlement({ ...valid, account: "" }).ok).toBe(false);
    expect(validateSettlement({ ...valid, account: "   " }).ok).toBe(false);
  });

  it("rejects an account containing characters other than letters, digits, and dashes", () => {
    expect(validateSettlement({ ...valid, account: "0912 345 678" }).ok).toBe(false);
    expect(validateSettlement({ ...valid, account: "acct#123" }).ok).toBe(false);
  });

  it("accepts an account with dashes", () => {
    expect(validateSettlement({ ...valid, account: "812-1234-5678901" })).toEqual({ ok: true });
  });

  it("rejects an account shorter than 4 characters", () => {
    expect(validateSettlement({ ...valid, account: "123" }).ok).toBe(false);
  });

  it("accepts an account at exactly 4 characters", () => {
    expect(validateSettlement({ ...valid, account: "1234" })).toEqual({ ok: true });
  });

  it("rejects an account longer than 30 characters", () => {
    expect(validateSettlement({ ...valid, account: "1".repeat(31) }).ok).toBe(false);
  });

  it("accepts an account at exactly 30 characters", () => {
    expect(validateSettlement({ ...valid, account: "1".repeat(30) })).toEqual({ ok: true });
  });

  it("rejects a non-finite, zero, negative, or non-integer amount", () => {
    expect(validateSettlement({ ...valid, amount: NaN }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: 0 }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: -100 }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: 100.5 }).ok).toBe(false);
  });

  it("accepts a positive integer amount", () => {
    expect(validateSettlement({ ...valid, amount: 1 })).toEqual({ ok: true });
  });
});

// The two settleable things (a won auction in `listings`, a fixed_price
// order in `purchases`) share one parameterized implementation — these
// pin down the differences that parameterization has to preserve.
describe("settling a won auction", () => {
  it("records the account and amount against the listing", async () => {
    await markListingSettled(7, "812-1234", 5000);

    expect(sentSql()).toBe(
      "UPDATE listings SET settled_at = NOW(), settlement_account = ?, settlement_amount = ? WHERE id = ? AND status = 'closed'",
    );
    expect(sentParams()).toEqual(["812-1234", 5000, 7]);
  });

  it("only clears settled_at on unsettle, keeping the recorded values for a re-settle", async () => {
    await unsettleListing(7);

    const sql = sentSql();
    expect(sql).toBe("UPDATE listings SET settled_at = NULL WHERE id = ? AND status = 'closed'");
    expect(sql).not.toContain("settlement_account");
    expect(sql).not.toContain("settlement_amount");
    expect(sentParams()).toEqual([7]);
  });

  it("reads the winner's contact details via leader_user_id", async () => {
    queryMock.mockResolvedValueOnce([[{ displayName: "阿明", phone: "0912", address: "台北" }]]);

    await expect(getWinnerProfileForListing(7)).resolves.toEqual({
      displayName: "阿明",
      phone: "0912",
      address: "台北",
    });
    expect(sentSql()).toContain("FROM listings t JOIN users u ON u.id = t.leader_user_id WHERE t.id = ?");
  });

  it("returns null when the listing has no winner", async () => {
    await expect(getWinnerProfileForListing(7)).resolves.toBeNull();
  });
});

describe("settling a fixed_price order", () => {
  it("records the account and amount against the purchase, with no closed-status guard", async () => {
    await markOrderSettled(3, "812-1234", 5000);

    const sql = sentSql();
    expect(sql).toBe(
      "UPDATE purchases SET settled_at = NOW(), settlement_account = ?, settlement_amount = ? WHERE id = ?",
    );
    // A purchases row is a completed sale the moment it exists — the
    // listings-only 'closed' guard must not leak onto this path.
    expect(sql).not.toContain("status");
    expect(sentParams()).toEqual(["812-1234", 5000, 3]);
  });

  it("only clears settled_at on unsettle", async () => {
    await unsettleOrder(3);

    expect(sentSql()).toBe("UPDATE purchases SET settled_at = NULL WHERE id = ?");
    expect(sentParams()).toEqual([3]);
  });

  it("reads the buyer's contact details via buyer_id", async () => {
    queryMock.mockResolvedValueOnce([[{ displayName: "小華", phone: "0922", address: "台中" }]]);

    await expect(getBuyerProfileForOrder(3)).resolves.toEqual({
      displayName: "小華",
      phone: "0922",
      address: "台中",
    });
    expect(sentSql()).toContain("FROM purchases t JOIN users u ON u.id = t.buyer_id WHERE t.id = ?");
  });
});
