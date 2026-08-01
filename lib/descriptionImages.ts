// Swaps the `cid:N` placeholders DescriptionEditor.extractForSubmit() writes
// into a listing's description HTML for the real URLs of the description
// images once they've been saved to disk (see lib/uploads.ts's
// saveDescriptionImages). Must run *before* sanitizeDescriptionHtml —
// DOMPurify has no reason to allow a `cid:` URI scheme, so it would strip
// these img tags if sanitization ran first.
export function resolveDescriptionImagePlaceholders(html: string, urls: string[]): string {
  return html.replace(/cid:(\d+)/g, (match, indexStr) => urls[Number(indexStr)] ?? match);
}
