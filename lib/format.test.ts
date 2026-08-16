import { describe, it, expect } from "vitest";
import { formatAdminDateTime } from "./format";

// formatAdminDateTime 是從 app/z04urru6 七個重複的 formatDate/formatDateTime
// 抽出來的共用工具（issue #139 M24）。行為必須跟原本的
// `new Date(x).toLocaleString("zh-TW", { hour12: false })` 完全一致。
describe("formatAdminDateTime", () => {
  it("接受 Date，輸出 24 小時制的 zh-TW 字串", () => {
    const date = new Date(2026, 0, 5, 13, 30, 0);
    expect(formatAdminDateTime(date)).toBe(date.toLocaleString("zh-TW", { hour12: false }));
  });

  it("接受 ISO 字串，與先轉成 Date 結果一致", () => {
    const iso = "2026-03-10T02:15:00.000Z";
    expect(formatAdminDateTime(iso)).toBe(new Date(iso).toLocaleString("zh-TW", { hour12: false }));
  });
});
