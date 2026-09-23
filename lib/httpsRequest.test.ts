// Issue #344: httpsRequest() gained (A-2) a shared keep-alive Agent passed
// on every request, and (A-1) an opt-in timeoutMs that destroys the request
// on expiry (the node:https equivalent of the AbortSignal.timeout(...)
// indexnow.ts/socialMedia.ts used to pass to fetch()). Mocked the same way
// lib/exchangeRates.test.ts mocks "https", since this is the module under
// test this time (rather than a caller of it).
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, agentInstances } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  agentInstances: [] as unknown[],
}));

vi.mock("https", () => ({
  request: requestMock,
  Agent: vi.fn().mockImplementation(function MockAgent(this: { options: unknown }, options: unknown) {
    this.options = options;
    agentInstances.push(this);
  }),
}));

beforeEach(() => {
  requestMock.mockReset();
  agentInstances.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

// Minimal fake of the http.ClientRequest/IncomingMessage pair node:https's
// request() hands back, same shape lib/exchangeRates.test.ts uses.
function queueHttpsSuccess(status: number, body: string) {
  requestMock.mockImplementationOnce((_url: string, _options: unknown, callback: (res: EventEmitter) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; setTimeout: (ms: number, cb: () => void) => void; destroy: (err?: Error) => void };
    req.end = () => {
      const res = new EventEmitter() as EventEmitter & { statusCode?: number };
      res.statusCode = status;
      callback(res);
      res.emit("data", body);
      res.emit("end");
    };
    req.setTimeout = () => {};
    req.destroy = () => {};
    return req;
  });
}

describe("httpsRequest", () => {
  it("passes a single shared keep-alive Agent as the request option", async () => {
    const { httpsRequest } = await import("./httpsRequest");
    queueHttpsSuccess(200, "ok");
    queueHttpsSuccess(200, "ok");

    await httpsRequest("https://example.com/a", { method: "GET" });
    await httpsRequest("https://example.com/b", { method: "GET" });

    expect(requestMock).toHaveBeenCalledTimes(2);
    const firstOptions = requestMock.mock.calls[0][1] as { agent?: unknown };
    const secondOptions = requestMock.mock.calls[1][1] as { agent?: unknown };
    expect(firstOptions.agent).toBeDefined();
    // Same object both times — one shared Agent, not a fresh one per call.
    expect(firstOptions.agent).toBe(secondOptions.agent);
    // Constructed with keepAlive: true.
    expect(agentInstances).toHaveLength(1);
    expect((agentInstances[0] as { options: { keepAlive: boolean } }).options).toEqual({ keepAlive: true });
  });

  it("does not set a timeout when timeoutMs is omitted (existing callers' behavior unchanged)", async () => {
    const { httpsRequest } = await import("./httpsRequest");
    let setTimeoutCalled = false;
    requestMock.mockImplementationOnce((_url: string, _options: unknown, callback: (res: EventEmitter) => void) => {
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        setTimeout: (ms: number, cb: () => void) => void;
      };
      req.setTimeout = () => {
        setTimeoutCalled = true;
      };
      req.end = () => {
        const res = new EventEmitter() as EventEmitter & { statusCode?: number };
        res.statusCode = 200;
        callback(res);
        res.emit("data", "ok");
        res.emit("end");
      };
      return req;
    });

    await httpsRequest("https://example.com", { method: "GET" });
    expect(setTimeoutCalled).toBe(false);
  });

  it("rejects when timeoutMs elapses, by destroying the request", async () => {
    const { httpsRequest } = await import("./httpsRequest");
    let destroyedWith: Error | undefined;
    requestMock.mockImplementationOnce(() => {
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        setTimeout: (ms: number, cb: () => void) => void;
        destroy: (err?: Error) => void;
      };
      req.setTimeout = (ms, cb) => {
        setTimeout(cb, ms);
      };
      req.destroy = (err) => {
        destroyedWith = err;
        req.emit("error", err);
      };
      req.end = () => {
        // Never calls back — simulates a hung request so the timeout fires.
      };
      return req;
    });

    const pending = httpsRequest("https://example.com/slow", { method: "GET", timeoutMs: 8000 });
    // Attach a rejection handler before advancing timers, so the eventual
    // rejection doesn't register as an unhandled promise rejection.
    const assertion = expect(pending).rejects.toThrow(/timed out after 8000ms/);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(destroyedWith?.message).toMatch(/timed out after 8000ms/);
  });
});
