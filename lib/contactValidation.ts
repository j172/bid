// Pure validation for the /contact form fields (issue #104) — no HTTP/DB
// involved, directly unit-testable, same split as lib/profile.ts /
// lib/newsValidation.ts. Doesn't require login: this form is public.

import { isValidEmail } from "@/lib/emailValidation";
import type { ErrorCode } from "@/lib/errorCodes";

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactValidationResult = { ok: true } | { ok: false; errorCode: ErrorCode };

export const CONTACT_NAME_MAX = 100;
export const CONTACT_SUBJECT_MAX = 200;
export const CONTACT_MESSAGE_MAX = 2000;

export function validateContact(input: ContactInput): ContactValidationResult {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, errorCode: "CONTACT_NAME_REQUIRED" };
  }
  if (name.length > CONTACT_NAME_MAX) {
    return { ok: false, errorCode: "CONTACT_NAME_TOO_LONG" };
  }

  // Shared with registration/newsletter via lib/emailValidation.ts (issue
  // #140 M-2) — this used to be its own `includes("@")` check.
  if (!isValidEmail(input.email)) {
    return { ok: false, errorCode: "EMAIL_INVALID" };
  }

  const subject = input.subject.trim();
  if (subject.length === 0) {
    return { ok: false, errorCode: "CONTACT_SUBJECT_REQUIRED" };
  }
  if (subject.length > CONTACT_SUBJECT_MAX) {
    return { ok: false, errorCode: "CONTACT_SUBJECT_TOO_LONG" };
  }

  const message = input.message.trim();
  if (message.length === 0) {
    return { ok: false, errorCode: "CONTACT_MESSAGE_REQUIRED" };
  }
  if (message.length > CONTACT_MESSAGE_MAX) {
    return { ok: false, errorCode: "CONTACT_MESSAGE_TOO_LONG" };
  }

  return { ok: true };
}
