// The single email-format rule for every public entry point that accepts an
// address (issue #140 M-2). Registration, the newsletter subscribe endpoint
// and the /contact form each used to do their own `email.includes("@")`
// check, which accepted anything with an at-sign in it — including strings
// like `=cmd|' /C calc'!A0@x.com`, which then travelled through the system
// as a real account email and landed in the admin CSV export as a live
// spreadsheet formula (see lib/csv.ts).
//
// Deliberately not a full RFC 5322 grammar: that accepts quoted local parts,
// comments and bare hostnames that no real signup form wants, and the
// resulting regex is unreadable. This aims at the practical rule instead —
// `local@domain.tld`, no whitespace, at least one dot in the domain — which
// is what actually keeps junk out.
//
// Pure, no I/O, directly unit-testable — same lib/-holds-the-rules split as
// lib/profile.ts's validateProfile and lib/listingValidation.ts.

// users.email / newsletter contacts are VARCHAR(255); anything longer can't
// be stored anyway.
export const EMAIL_MAX_LENGTH = 255;

// Local part: the RFC 5322 "atext" set, dot-separated. Domain: dot-separated
// LDH labels ending in an alphabetic TLD of 2+ characters.
const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Spreadsheet formula lead-ins (CWE-1236). `+`, `=` and `-` are technically
// legal atext characters, so the pattern above would let an address *start*
// with one; no real address does, and refusing them here stops the value at
// the front door rather than relying on lib/csv.ts's escaping alone —
// defence in depth, since an email that reaches a CSV is not the only place
// it gets rendered.
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > EMAIL_MAX_LENGTH) return false;
  if (FORMULA_PREFIXES.includes(trimmed[0])) return false;
  return EMAIL_PATTERN.test(trimmed);
}
