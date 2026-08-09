import { describe, expect, it } from "vitest";
import { resolveStatusBadgeVariant } from "./statusBadge";

describe("resolveStatusBadgeVariant", () => {
  it("puts lifecycle status ahead of everything else", () => {
    expect(resolveStatusBadgeVariant("scheduled").key).toBe("scheduled");
    expect(resolveStatusBadgeVariant("cancelled").key).toBe("cancelled");
    // Even a 'leading' stance loses to a closed listing — a won auction
    // reads as 已結標, not 目前領先.
    expect(resolveStatusBadgeVariant("closed", true).key).toBe("closed");
    expect(resolveStatusBadgeVariant("settled", true).key).toBe("closed");
  });

  it("treats any unrecognised status as closed", () => {
    expect(resolveStatusBadgeVariant("something_new").key).toBe("closed");
  });

  it("shows the visitor's own standing on an open auction when the view has one", () => {
    expect(resolveStatusBadgeVariant("open", true).key).toBe("leading");
    expect(resolveStatusBadgeVariant("open", false).key).toBe("outbid");
  });

  it("distinguishes 'no opinion' from 'outbid'", () => {
    // undefined means the view has no per-visitor stance (the public grid),
    // which must not be read as "you have been outbid".
    expect(resolveStatusBadgeVariant("open", undefined).key).toBe("bidding");
    expect(resolveStatusBadgeVariant("open", false).key).toBe("outbid");
  });

  it("calls an open fixed-price listing on sale rather than bidding", () => {
    expect(resolveStatusBadgeVariant("open", undefined, true).key).toBe("onSale");
    expect(resolveStatusBadgeVariant("open", undefined, false).key).toBe("bidding");
  });

  it("gives every variant a non-empty class string", () => {
    const cases: Array<[string, boolean | undefined, boolean | undefined]> = [
      ["scheduled", undefined, undefined],
      ["cancelled", undefined, undefined],
      ["closed", undefined, undefined],
      ["open", true, undefined],
      ["open", false, undefined],
      ["open", undefined, true],
      ["open", undefined, false],
    ];
    for (const [status, isLeading, isFixedPrice] of cases) {
      expect(resolveStatusBadgeVariant(status, isLeading, isFixedPrice).className).toContain("rounded-full");
    }
  });
});
