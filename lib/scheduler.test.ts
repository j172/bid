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

const { scheduleMock, syncExchangeRatesMock, syncHerbotsNewsMock, syncRacesMock } = vi.hoisted(() => ({
  scheduleMock: vi.fn(),
  syncExchangeRatesMock: vi.fn(),
  syncHerbotsNewsMock: vi.fn(),
  syncRacesMock: vi.fn(),
}));

vi.mock("node-cron", () => ({ default: { schedule: scheduleMock } }));
vi.mock("@/lib/exchangeRates", () => ({ syncExchangeRates: syncExchangeRatesMock }));
// issue #240: scheduler.ts also wires up the daily herbots.be news sync —
// mocked for the same "this module's job is wiring, not the sync itself"
// reason as @/lib/exchangeRates above (lib/newsSync.ts has its own tests).
vi.mock("@/lib/newsSync", () => ({ syncHerbotsNews: syncHerbotsNewsMock }));
// issue #241: scheduler.ts also wires up the daily races sync — same
// mocking reason as @/lib/newsSync above (lib/racesSync.ts has its own
// tests).
vi.mock("@/lib/racesSync", () => ({ syncRaces: syncRacesMock }));

beforeEach(() => {
  vi.resetModules();
  scheduleMock.mockReset();
  syncExchangeRatesMock.mockReset();
  syncHerbotsNewsMock.mockReset();
  syncRacesMock.mockReset();
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

    // Three distinct cron jobs are registered per call (exchange rates +
    // news + races, see below) — asserting 3 here (not 1) is what actually
    // proves a second startScheduler() call registered nothing further.
    expect(scheduleMock).toHaveBeenCalledTimes(3);
    expect(syncExchangeRatesMock).toHaveBeenCalledTimes(1);
  });
});

// issue #240
describe("startScheduler — herbots.be news sync", () => {
  it("registers the 08:40 Asia/Taipei cron job", async () => {
    const { startScheduler } = await import("./scheduler");

    startScheduler();

    expect(scheduleMock).toHaveBeenCalledWith("40 8 * * *", expect.any(Function), { timezone: "Asia/Taipei" });
  });

  it("does not sync on boot (unlike exchange rates, which has a startup sync)", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(syncHerbotsNewsMock).not.toHaveBeenCalled();
  });

  it("runs syncHerbotsNews when the registered cron callback fires", async () => {
    const { startScheduler } = await import("./scheduler");
    syncHerbotsNewsMock.mockResolvedValue({
      imported: 1,
      skippedExisting: 0,
      skippedNoContent: 0,
      translationFailures: 0,
      errors: [],
    });

    startScheduler();
    const newsCall = scheduleMock.mock.calls.find(([pattern]) => pattern === "40 8 * * *");
    const callback = newsCall?.[1] as () => void;
    callback();
    await vi.waitFor(() => expect(syncHerbotsNewsMock).toHaveBeenCalledTimes(1));
  });

  it("logs rather than throws when the sync rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { startScheduler } = await import("./scheduler");
    const syncError = new Error("boom");
    syncHerbotsNewsMock.mockRejectedValue(syncError);

    startScheduler();
    const newsCall = scheduleMock.mock.calls.find(([pattern]) => pattern === "40 8 * * *");
    const callback = newsCall?.[1] as () => void;
    callback();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledWith("[newsSync] scheduled sync failed", syncError));

    errorSpy.mockRestore();
  });
});

// issue #241
describe("startScheduler — races sync", () => {
  it("registers a second 08:40 Asia/Taipei cron job (same batch as the news sync)", async () => {
    const { startScheduler } = await import("./scheduler");

    startScheduler();

    const racesCalls = scheduleMock.mock.calls.filter(([pattern]) => pattern === "40 8 * * *");
    expect(racesCalls).toHaveLength(2);
    expect(racesCalls[1][2]).toEqual({ timezone: "Asia/Taipei" });
  });

  it("does not sync on boot", async () => {
    const { startScheduler } = await import("./scheduler");
    syncExchangeRatesMock.mockResolvedValue(undefined);

    startScheduler();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(syncRacesMock).not.toHaveBeenCalled();
  });

  it("runs syncRaces when the registered cron callback fires", async () => {
    const { startScheduler } = await import("./scheduler");
    syncRacesMock.mockResolvedValue({
      loingMa: { imported: 1, updated: 0, errors: [], skipped: false },
      herbots: { imported: 2, updated: 0, errors: [], translationFailures: 0 },
    });

    startScheduler();
    const racesCalls = scheduleMock.mock.calls.filter(([pattern]) => pattern === "40 8 * * *");
    const callback = racesCalls[1][1] as () => void;
    callback();
    await vi.waitFor(() => expect(syncRacesMock).toHaveBeenCalledTimes(1));
  });

  it("logs rather than throws when the sync rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { startScheduler } = await import("./scheduler");
    const syncError = new Error("boom");
    syncRacesMock.mockRejectedValue(syncError);

    startScheduler();
    const racesCalls = scheduleMock.mock.calls.filter(([pattern]) => pattern === "40 8 * * *");
    const callback = racesCalls[1][1] as () => void;
    callback();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledWith("[racesSync] scheduled sync failed", syncError));

    errorSpy.mockRestore();
  });
});
