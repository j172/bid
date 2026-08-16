// Pure/no-I/O helpers shared by the news create/edit API routes (issue #80)
// — directly unit-testable, same split as this project's other
// lib/*Validation.ts-style helpers. resolveBroadcastLock/
// createAndSendNewsBroadcast (issue #160 M4) do involve I/O, so their tests
// below mock @/lib/newsletter and @/lib/news the same way lib/apiAuth.test.ts
// mocks @/lib/auth.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBroadcastMock, createBroadcastMock, sendBroadcastMock, setNewsBroadcastIdMock } = vi.hoisted(() => ({
  getBroadcastMock: vi.fn(),
  createBroadcastMock: vi.fn(),
  sendBroadcastMock: vi.fn(),
  setNewsBroadcastIdMock: vi.fn(),
}));

vi.mock("@/lib/newsletter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/newsletter")>();
  return {
    ...actual,
    getBroadcast: getBroadcastMock,
    createBroadcast: createBroadcastMock,
    sendBroadcast: sendBroadcastMock,
  };
});

vi.mock("@/lib/news", () => ({
  setNewsBroadcastId: setNewsBroadcastIdMock,
}));

import {
  createAndSendNewsBroadcast,
  newsletterErrorMessage,
  parseScheduledAt,
  resolveBroadcastLock,
  resolveOrigin,
} from "./newsNewsletterSync";

beforeEach(() => {
  getBroadcastMock.mockReset();
  createBroadcastMock.mockReset();
  sendBroadcastMock.mockReset();
  setNewsBroadcastIdMock.mockReset();
});

describe("parseScheduledAt", () => {
  it("treats empty input as 'send immediately' (ok, no scheduledAt)", () => {
    expect(parseScheduledAt("")).toEqual({ ok: true });
  });

  it("accepts a valid future date and normalizes it to ISO", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(parseScheduledAt(future)).toEqual({ ok: true, scheduledAt: future });
  });

  it("rejects a past date", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(parseScheduledAt(past)).toEqual({ ok: false });
  });

  it("rejects an unparseable date string", () => {
    expect(parseScheduledAt("not-a-date")).toEqual({ ok: false });
  });
});

describe("newsletterErrorMessage", () => {
  it("reports the NOT_CONFIGURED case the same regardless of stage", () => {
    expect(newsletterErrorMessage("NOT_CONFIGURED", "create")).toContain("尚未設定");
    expect(newsletterErrorMessage("NOT_CONFIGURED", "send")).toContain("尚未設定");
  });

  it("distinguishes create-stage vs send-stage provider errors", () => {
    const createMessage = newsletterErrorMessage("PROVIDER_ERROR", "create");
    const sendMessage = newsletterErrorMessage("PROVIDER_ERROR", "send");
    expect(createMessage).not.toEqual(sendMessage);
    expect(sendMessage).toContain("已建立");
  });

  // The "cancel" stage exists so app/api/admin/newsletter/[id]'s DELETE can
  // answer with a translated `error` like every other admin route, instead
  // of handing the raw BroadcastErrorCode to a UI with no catalogue to
  // resolve it against (issue #139 M4).
  it("phrases the cancel stage as a cancel failure, not a send failure", () => {
    const cancelMessage = newsletterErrorMessage("PROVIDER_ERROR", "cancel");
    expect(cancelMessage).toContain("取消");
    expect(cancelMessage).not.toContain("寄送失敗");
    expect(cancelMessage).not.toEqual(newsletterErrorMessage("PROVIDER_ERROR", "send"));
  });

  it("still names the missing configuration at the cancel stage", () => {
    const cancelMessage = newsletterErrorMessage("NOT_CONFIGURED", "cancel");
    expect(cancelMessage).toContain("尚未設定");
    expect(cancelMessage).toContain("取消");
  });

  it("tells the admin a broadcast is already gone rather than blaming the provider", () => {
    expect(newsletterErrorMessage("NOT_FOUND", "cancel")).toContain("找不到");
  });
});

describe("resolveOrigin", () => {
  it("prefers X-Forwarded-Host/Proto when present (this host's reverse proxy)", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/news", {
      headers: { "x-forwarded-host": "bid.j172.tw", "x-forwarded-proto": "https" },
    });
    expect(resolveOrigin(request)).toBe("https://bid.j172.tw");
  });

  it("falls back to plain Host with https when no forwarded proto is given", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/news", {
      headers: { host: "bid.j172.tw" },
    });
    expect(resolveOrigin(request)).toBe("https://bid.j172.tw");
  });

  it("falls back to the request's own URL origin when neither header is present (local dev)", () => {
    const request = new Request("http://localhost:3000/api/admin/news");
    expect(resolveOrigin(request)).toBe("http://localhost:3000");
  });
});

describe("resolveBroadcastLock", () => {
  it("returns unlocked/null when there's no broadcastId yet", async () => {
    const result = await resolveBroadcastLock(null);
    expect(result).toEqual({ status: null, unknown: false });
    expect(getBroadcastMock).not.toHaveBeenCalled();
  });

  it("returns the live status when the fetch succeeds", async () => {
    getBroadcastMock.mockResolvedValue({ ok: true, broadcast: { id: "b1", status: "scheduled" } });
    const result = await resolveBroadcastLock("b1");
    expect(result).toEqual({ status: "scheduled", unknown: false });
  });

  it("treats a gone broadcast (NOT_FOUND) as unlocked/null, not unknown", async () => {
    getBroadcastMock.mockResolvedValue({ ok: false, errorCode: "NOT_FOUND" });
    const result = await resolveBroadcastLock("b1");
    expect(result).toEqual({ status: null, unknown: false });
  });

  it("reports unknown when the status fetch fails for any other reason", async () => {
    getBroadcastMock.mockResolvedValue({ ok: false, errorCode: "PROVIDER_ERROR" });
    const result = await resolveBroadcastLock("b1");
    expect(result).toEqual({ status: null, unknown: true });
  });
});

describe("createAndSendNewsBroadcast", () => {
  const baseParams = {
    newsId: 42,
    title: "測試標題",
    content: "<p>內容</p>",
    detailUrl: "https://bid.j172.tw/news/42",
    scheduledAtRaw: "",
    invalidScheduleError: "排程時間必須是有效的未來時間，電子報未寄送。",
  };

  it("reports the invalid-schedule error and does nothing else when the schedule is bad", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = await createAndSendNewsBroadcast({ ...baseParams, scheduledAtRaw: past });

    expect(result).toEqual({ newsletterError: baseParams.invalidScheduleError });
    expect(createBroadcastMock).not.toHaveBeenCalled();
    expect(setNewsBroadcastIdMock).not.toHaveBeenCalled();
    expect(sendBroadcastMock).not.toHaveBeenCalled();
  });

  it("creates and sends on a valid (immediate) schedule, persisting the broadcast id first", async () => {
    createBroadcastMock.mockResolvedValue({ ok: true, id: "b1" });
    sendBroadcastMock.mockResolvedValue({ ok: true });

    const result = await createAndSendNewsBroadcast(baseParams);

    expect(result).toEqual({});
    expect(createBroadcastMock).toHaveBeenCalledWith(baseParams.title, expect.stringContaining(baseParams.content));
    expect(setNewsBroadcastIdMock).toHaveBeenCalledWith(baseParams.newsId, "b1");
    expect(sendBroadcastMock).toHaveBeenCalledWith("b1", undefined);
  });

  it("reports the create-stage error and never calls send/persist when create fails", async () => {
    createBroadcastMock.mockResolvedValue({ ok: false, errorCode: "PROVIDER_ERROR" });

    const result = await createAndSendNewsBroadcast(baseParams);

    expect(result.newsletterError).toBe(newsletterErrorMessage("PROVIDER_ERROR", "create"));
    expect(setNewsBroadcastIdMock).not.toHaveBeenCalled();
    expect(sendBroadcastMock).not.toHaveBeenCalled();
  });

  it("still persists the broadcast id even when the send stage fails", async () => {
    createBroadcastMock.mockResolvedValue({ ok: true, id: "b1" });
    sendBroadcastMock.mockResolvedValue({ ok: false, errorCode: "PROVIDER_ERROR" });

    const result = await createAndSendNewsBroadcast(baseParams);

    expect(result.newsletterError).toBe(newsletterErrorMessage("PROVIDER_ERROR", "send"));
    expect(setNewsBroadcastIdMock).toHaveBeenCalledWith(baseParams.newsId, "b1");
  });

  it("runs beforeCreate only after the schedule is confirmed valid", async () => {
    const beforeCreate = vi.fn().mockResolvedValue(undefined);
    const past = new Date(Date.now() - 60_000).toISOString();

    await createAndSendNewsBroadcast({ ...baseParams, scheduledAtRaw: past, beforeCreate });

    expect(beforeCreate).not.toHaveBeenCalled();
  });

  it("runs beforeCreate before creating the new broadcast when the schedule is valid", async () => {
    const calls: string[] = [];
    const beforeCreate = vi.fn().mockImplementation(async () => {
      calls.push("beforeCreate");
    });
    createBroadcastMock.mockImplementation(async () => {
      calls.push("createBroadcast");
      return { ok: true, id: "b2" };
    });
    sendBroadcastMock.mockResolvedValue({ ok: true });

    await createAndSendNewsBroadcast({ ...baseParams, beforeCreate });

    expect(calls).toEqual(["beforeCreate", "createBroadcast"]);
  });
});
