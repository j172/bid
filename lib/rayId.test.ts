import { describe, expect, it } from "vitest";
import { generateRayId } from "./rayId";

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
