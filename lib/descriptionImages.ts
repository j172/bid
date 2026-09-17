// Swaps the `cid:N` placeholders DescriptionEditor/SimpleRichTextEditor's
// extractForSubmit() write into a rich-text field's HTML for the real URLs of
// the description images once they've been saved to disk (see
// lib/uploads.ts's saveDescriptionImages) — shared by every content type with
// an inline-image-capable editor (listings/products/news/pigeon-showcase/
// homepage-sections, issue #315). Must run *before* sanitizeDescriptionHtml —
// it has no reason to allow a `cid:` URI scheme, so it would strip these img
// tags if sanitization ran first.
export function resolveDescriptionImagePlaceholders(html: string, urls: string[]): string {
  return html.replace(/cid:(\d+)/g, (match, indexStr) => urls[Number(indexStr)] ?? match);
}
