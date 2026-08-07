// issue #81: the on-boot exchange-rate sync used to fire synchronously
// inside startScheduler(), racing Next.js's own cold-start CPU/memory
// pressure right after process boot (see scheduler.ts's own comment for the
// production evidence). It's now delayed a few seconds instead — these
// tests pin that behavior down so a future change can't silently regress it
// back to firing immediately.
//
// node-cron and @/lib/exchangeRates are both mocked since this module's job
// is wiring, not scheduling logic or the sync itself (both already covered
// elsewhere — node-cron by its own package, syncExchangeRates by
// lib/exchangeRates.test.ts). startScheduler() also guards itself with a
// module-level `started` flag (see its own comment), so each test needs a
// fresh module instance via vi.resetModules() + a fresh dynamic import.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { scheduleMock, syncExchangeRatesMock } = vi.hoisted(() => ({
  scheduleMock: vi.fn(),
  syncExchangeRatesMock: vi.fn(),
}));

vi.mock("node-cron", () => ({ default: { schedule: scheduleMock } }));
vi.mock("@/lib/exchangeRates", () => ({ syncExchangeRates: syncExchangeRatesMock }));

beforeEach(() => {
  vi.resetModules();
  scheduleMock.mockReset();
  syncExchangeRatesMock.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startScheduler", () => {
  it("registers the 08:10 Asia/Taipei cron job", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();

    expect(scheduleMock).toHaveBeenCalledWith("10 8 * * *", expect.any(Function), { timezone: "Asia/Taipei" });
  });

  it("does not sync immediately on boot", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();

    expect(syncExchangeRatesMock).not.toHaveBeenCalled();
  });

  it("syncs once the boot delay elapses", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(syncExchangeRatesMock).toHaveBeenCalledTimes(1);
  });

  it("logs rather than throws when the delayed startup sync rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { startScheduler } = await import("./scheduler");
    const bootError = new Error("boom");
    syncExchangeRatesMock.mockRejectedValue(bootError);

    startScheduler();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(errorSpy).toHaveBeenCalledWith("[exchangeRates] startup sync failed", bootError);
    errorSpy.mockRestore();
  });

  it("only registers/syncs once even if called twice (idempotent across fast-refresh reloads)", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();
    startScheduler();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(syncExchangeRatesMock).toHaveBeenCalledTimes(1);
  });
});
