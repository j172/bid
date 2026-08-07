// Rough (regex-based, not a real HTML parser) HTML-to-plain-text helpers —
// same non-goal as descriptionPlainTextLength in lib/listingValidation.ts
// (this isn't a security boundary, sanitizeDescriptionHtml.ts is), just
// needs to behave identically in the browser and in Node without pulling in
// a DOM implementation on either side. Extracted here (rather than reusing
// listingValidation.ts's version, which only returns a length) because
// issue #54's homepage carousel cards and pigeon-showcase list page need the
// actual excerpt text, not just a character count.

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Truncates to at most maxLength plain-text characters, appending an
// ellipsis when it actually cut something off (never on an exact fit).
export function excerptHtml(html: string, maxLength: number): string {
  const text = htmlToPlainText(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
