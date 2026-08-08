import { describe, expect, it } from "vitest";
import { generateRayId, getRayIdFromHeaders, resolveRayId } from "./rayId";

describe("generateRayId", () => {
  it("returns 16 lowercase hex characters", () => {
    expect(generateRayId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces a different value on each call", () => {
    // Astronomically unlikely to collide by chance across a handful of
    // calls; a collision here would mean the RNG isn't being re-seeded.
    const ids = new Set(Array.from({ length: 20 }, () => generateRayId()));
    expect(ids.size).toBe(20);
  });
});

describe("getRayIdFromHeaders", () => {
  it("returns the forwarded real Ray ID", () => {
    const headers = new Headers({ "x-real-ray-id": "8a3f1c2d9b7e0f11" });
    expect(getRayIdFromHeaders(headers)).toBe("8a3f1c2d9b7e0f11");
  });

  it("returns null when the header is missing", () => {
    expect(getRayIdFromHeaders(new Headers())).toBeNull();
  });

  it("returns null when the header is present but blank", () => {
    const headers = new Headers({ "x-real-ray-id": "   " });
    expect(getRayIdFromHeaders(headers)).toBeNull();
  });
});

describe("resolveRayId", () => {
  it("prefers the forwarded real Ray ID when present", () => {
    const headers = new Headers({ "x-real-ray-id": "8a3f1c2d9b7e0f11" });
    expect(resolveRayId(headers)).toBe("8a3f1c2d9b7e0f11");
  });

  it("falls back to a generated Ray ID when the header is absent", () => {
    expect(resolveRayId(new Headers())).toMatch(/^[0-9a-f]{16}$/);
  });
});
