// Whitelist-sanitizes listing description HTML produced by the TinyMCE
// editor (app/z04urru6/listings/DescriptionEditor.tsx) before it's stored
// or rendered. Runs on the server only: the public listing page renders
// this HTML via dangerouslySetInnerHTML, so anything that slips through
// here is a stored-XSS hole for every visitor, not just the admin who
// authored it — see the "sanitize on write" decision this followed from.
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h2", "h3",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "td", "th",
  "span", "div",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "colspan", "rowspan",
  "style",
];

// Matches the brand-restricted color_map wired into the TinyMCE toolbar
// (DescriptionEditor.tsx) — re-checked here because the client's color
// picker restriction is only a UX nicety, not a security boundary.
const ALLOWED_STYLE_DECLARATION =
  /^(color|background-color)\s*:\s*#[0-9a-f]{3,8}$|^font-size\s*:\s*\d{1,3}(px|%)$|^text-align\s*:\s*(left|center|right|justify)$/i;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style" || !data.attrValue) return;
  const kept = data.attrValue
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0 && ALLOWED_STYLE_DECLARATION.test(declaration));
  data.attrValue = kept.join("; ");
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("rel", "noopener noreferrer nofollow");
    if (node.getAttribute("target") !== "_blank") node.removeAttribute("target");
  }
});

export function sanitizeDescriptionHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR }).trim();
}
