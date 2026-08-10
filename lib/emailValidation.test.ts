// Pure validation, no mocking needed — same shape as
// lib/contactValidation.test.ts / lib/profile.test.ts.
import { describe, expect, it } from "vitest";
import { EMAIL_MAX_LENGTH, isValidEmail } from "./emailValidation";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("visitor@example.com")).toBe(true);
    expect(isValidEmail("first.last@sub.example.co.uk")).toBe(true);
    expect(isValidEmail("visitor+tag@example.com")).toBe(true); // plus-addressing stays usable
    expect(isValidEmail("user_name-123@my-host.tw")).toBe(true);
  });

  it("trims surrounding whitespace before judging", () => {
    expect(isValidEmail("  visitor@example.com  ")).toBe(true);
  });

  it("rejects the strings the old includes(\"@\") check let through", () => {
    expect(isValidEmail("@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("visitor@")).toBe(false);
    expect(isValidEmail("visitor@localhost")).toBe(false); // no dotted TLD
    expect(isValidEmail("visitor@example.")).toBe(false);
    expect(isValidEmail("two@at@example.com")).toBe(false);
    expect(isValidEmail("has space@example.com")).toBe(false);
    expect(isValidEmail("with\nnewline@example.com")).toBe(false);
  });

  it("rejects an empty or blank value", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });

  it("rejects spreadsheet-formula lead-ins (CWE-1236, issue #140 M-2)", () => {
    expect(isValidEmail("=cmd|' /C calc'!A0@x.com")).toBe(false);
    expect(isValidEmail("=HYPERLINK(\"http://evil\")@x.com")).toBe(false);
    expect(isValidEmail("+attacker@example.com")).toBe(false);
    expect(isValidEmail("-attacker@example.com")).toBe(false);
    expect(isValidEmail("@attacker@example.com")).toBe(false);
  });

  it("rejects anything longer than the column can store", () => {
    const local = "a".repeat(EMAIL_MAX_LENGTH);
    expect(isValidEmail(`${local}@example.com`)).toBe(false);
  });
});
