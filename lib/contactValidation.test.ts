import { describe, expect, it } from "vitest";
import { CONTACT_MESSAGE_MAX, CONTACT_NAME_MAX, CONTACT_SUBJECT_MAX, validateContact } from "./contactValidation";

const validInput = {
  name: "王小明",
  email: "test@example.com",
  subject: "詢問訂單狀態",
  message: "請問我的訂單什麼時候會出貨？",
};

describe("validateContact", () => {
  it("accepts a fully filled-in submission", () => {
    expect(validateContact(validInput)).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateContact({ ...validInput, name: "" })).toEqual({ ok: false, errorCode: "CONTACT_NAME_REQUIRED" });
    expect(validateContact({ ...validInput, name: "   " })).toEqual({ ok: false, errorCode: "CONTACT_NAME_REQUIRED" });
  });

  it("rejects a name over the max length", () => {
    expect(validateContact({ ...validInput, name: "a".repeat(CONTACT_NAME_MAX + 1) })).toEqual({
      ok: false,
      errorCode: "CONTACT_NAME_TOO_LONG",
    });
  });

  it("accepts a name at exactly the max length", () => {
    expect(validateContact({ ...validInput, name: "a".repeat(CONTACT_NAME_MAX) })).toEqual({ ok: true });
  });

  it("rejects an empty or malformed email", () => {
    expect(validateContact({ ...validInput, email: "" })).toEqual({ ok: false, errorCode: "EMAIL_INVALID" });
    expect(validateContact({ ...validInput, email: "not-an-email" })).toEqual({ ok: false, errorCode: "EMAIL_INVALID" });
  });

  it("rejects an empty or whitespace-only subject", () => {
    expect(validateContact({ ...validInput, subject: "" })).toEqual({ ok: false, errorCode: "CONTACT_SUBJECT_REQUIRED" });
    expect(validateContact({ ...validInput, subject: "  " })).toEqual({ ok: false, errorCode: "CONTACT_SUBJECT_REQUIRED" });
  });

  it("rejects a subject over the max length", () => {
    expect(validateContact({ ...validInput, subject: "a".repeat(CONTACT_SUBJECT_MAX + 1) })).toEqual({
      ok: false,
      errorCode: "CONTACT_SUBJECT_TOO_LONG",
    });
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(validateContact({ ...validInput, message: "" })).toEqual({ ok: false, errorCode: "CONTACT_MESSAGE_REQUIRED" });
    expect(validateContact({ ...validInput, message: "   " })).toEqual({ ok: false, errorCode: "CONTACT_MESSAGE_REQUIRED" });
  });

  it("rejects a message over the max length", () => {
    expect(validateContact({ ...validInput, message: "a".repeat(CONTACT_MESSAGE_MAX + 1) })).toEqual({
      ok: false,
      errorCode: "CONTACT_MESSAGE_TOO_LONG",
    });
  });

  it("accepts a message at exactly the max length", () => {
    expect(validateContact({ ...validInput, message: "a".repeat(CONTACT_MESSAGE_MAX) })).toEqual({ ok: true });
  });
});
