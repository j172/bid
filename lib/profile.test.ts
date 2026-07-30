import { describe, expect, it } from "vitest";
import { validateProfile } from "./profile";

const valid = { displayName: "王小明", phone: "0912-345-678", address: "台北市信義區信義路一段1號" };

describe("validateProfile", () => {
  it("accepts a well-formed profile", () => {
    expect(validateProfile(valid)).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only display name", () => {
    expect(validateProfile({ ...valid, displayName: "" }).ok).toBe(false);
    expect(validateProfile({ ...valid, displayName: "   " }).ok).toBe(false);
  });

  it("rejects a display name over 50 characters", () => {
    const result = validateProfile({ ...valid, displayName: "a".repeat(51) });
    expect(result.ok).toBe(false);
  });

  it("accepts a display name at exactly 50 characters", () => {
    expect(validateProfile({ ...valid, displayName: "a".repeat(50) })).toEqual({ ok: true });
  });

  it("rejects a phone containing letters or other symbols", () => {
    expect(validateProfile({ ...valid, phone: "0912abc678" }).ok).toBe(false);
    expect(validateProfile({ ...valid, phone: "+886912345678" }).ok).toBe(false);
  });

  it("rejects a phone with too few or too many digits", () => {
    expect(validateProfile({ ...valid, phone: "123456" }).ok).toBe(false); // 6 digits
    expect(validateProfile({ ...valid, phone: "1234567890123456" }).ok).toBe(false); // 16 digits
  });

  it("accepts phones at the digit-count boundaries", () => {
    expect(validateProfile({ ...valid, phone: "1234567" })).toEqual({ ok: true }); // 7 digits
    expect(validateProfile({ ...valid, phone: "123456789012345" })).toEqual({ ok: true }); // 15 digits
  });

  it("allows dashes and spaces in the phone without counting them as digits", () => {
    expect(validateProfile({ ...valid, phone: "09 1234 5678" })).toEqual({ ok: true }); // 10 digits
  });

  it("rejects an empty address", () => {
    expect(validateProfile({ ...valid, address: "" }).ok).toBe(false);
  });

  it("rejects an address over 200 characters", () => {
    expect(validateProfile({ ...valid, address: "a".repeat(201) }).ok).toBe(false);
  });

  it("accepts an address at exactly 200 characters", () => {
    expect(validateProfile({ ...valid, address: "a".repeat(200) })).toEqual({ ok: true });
  });
});
