// Issue #140 M-4: /api/health is public and unauthenticated, so a failed DB
// check must not leak the driver's own error text (which carries the DB
// username and an internal host/IP) in production. Mocks @/lib/db's getDb
// the same way lib/passwordReset.test.ts mocks its DB layer.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

import { GET } from "./route";

// A realistic mysql2 connection failure — exactly the shape that must never
// reach an anonymous caller.
const LEAKY_ERROR = new Error("Access denied for user 'bid_prod'@'10.1.2.3' (using password: YES)");

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string) {
  // NODE_ENV is typed as a readonly literal union, hence the cast.
  (process.env as Record<string, string>).NODE_ENV = value;
}

beforeEach(() => {
  getDbMock.mockReset();
});

afterEach(() => {
  setNodeEnv(originalNodeEnv ?? "test");
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    getDbMock.mockResolvedValue({ query: vi.fn().mockResolvedValue([[{ ok: 1 }]]) });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.db).toBe("connected");
    expect(data.dbError).toBeUndefined();
  });

  it("returns a fixed message in production, never the driver's error text", async () => {
    setNodeEnv("production");
    getDbMock.mockRejectedValue(LEAKY_ERROR);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.db).toBe("error");
    expect(data.dbError).toBe("db unavailable");
    expect(JSON.stringify(data)).not.toContain("bid_prod");
    expect(JSON.stringify(data)).not.toContain("10.1.2.3");
    // The real detail is still recorded server-side.
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps the real error visible outside production, where the detail is the point", async () => {
    setNodeEnv("development");
    getDbMock.mockRejectedValue(LEAKY_ERROR);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const data = await response.json();

    expect(data.dbError).toBe(LEAKY_ERROR.message);
  });
});
