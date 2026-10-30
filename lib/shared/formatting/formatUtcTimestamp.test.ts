import { describe, expect, it } from "vitest";
import { formatUtcTimestamp } from "./formatUtcTimestamp";

describe("formatUtcTimestamp", () => {
  it("formats as 'YYYY-MM-DD HH:mm:ss UTC'", () => {
    const date = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(formatUtcTimestamp(date)).toBe("2026-01-02 03:04:05 UTC");
  });
});
