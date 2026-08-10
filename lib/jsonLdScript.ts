// Safe serialization of a JSON-LD object into an inline
// <script type="application/ld+json"> block (issue #140 M-1).
//
// JSON.stringify() alone is NOT enough here: it escapes what JSON needs, not
// what HTML needs, so a string value containing the literal characters
// "</script>" survives verbatim into the page and closes the script element
// early — everything after it is then parsed as markup. The listing detail
// page feeds admin-editable fields (listing.title, which never goes through
// lib/sanitizeDescriptionHtml.ts) straight into this, so a crafted title
// would otherwise be stored XSS on a public page.
//
// The fix is the standard one: emit the three characters that can start an
// HTML token as \uXXXX escapes. JSON parsers decode them back to the same
// characters, so the JSON-LD a crawler reads is byte-for-byte the same
// document — only the HTML tokenizer sees a difference.
//
// A pure string function (no React/DOM involved) so it is directly unit
// testable, same lib/-holds-the-logic split as lib/htmlText.ts and
// lib/sanitizeDescriptionHtml.ts.
export function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    // & can't open a tag on its own, but escaping it too keeps the output
    // safe if it is ever embedded somewhere HTML entities are decoded before
    // the script body is read (e.g. inside an XHTML/SVG <script>).
    .replace(/&/g, "\\u0026");
}
