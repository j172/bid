// Whitelist-sanitizes listing description HTML produced by the TinyMCE
// editor (app/z04urru6/listings/DescriptionEditor.tsx) before it's stored
// or rendered. Runs on the server only: the public listing page renders
// this HTML via dangerouslySetInnerHTML, so anything that slips through
// here is a stored-XSS hole for every visitor, not just the admin who
// authored it — see the "sanitize on write" decision this followed from.
//
// Uses sanitize-html (pure JS, no DOM emulation) rather than
// isomorphic-dompurify/jsdom — the latter failed to bundle under Next's
// Turbopack server build ("Failed to load external module jsdom") when
// this was first wired up.
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h2", "h3",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "td", "th",
  "span", "div",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "width", "height", "colspan", "rowspan", "style"];

// Matches the brand-restricted color_map wired into the TinyMCE toolbar
// (DescriptionEditor.tsx) — re-checked here because the client's color
// picker restriction is only a UX nicety, not a security boundary.
const ALLOWED_STYLE_DECLARATION =
  /^(color|background-color)\s*:\s*#[0-9a-f]{3,8}$|^font-size\s*:\s*\d{1,3}(px|%)$|^text-align\s*:\s*(left|center|right|justify)$/i;

function filterStyleAttribute(tagName: string, attribs: Record<string, string>) {
  if (!attribs.style) return { tagName, attribs };
  const kept = attribs.style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0 && ALLOWED_STYLE_DECLARATION.test(declaration))
    .join("; ");
  const { style: _style, ...rest } = attribs;
  return { tagName, attribs: kept ? { ...rest, style: kept } : rest };
}

export function sanitizeDescriptionHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    // img src values are our own /uploads/... paths — no data: needed.
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      // Both the tag-specific and "*" transforms run (specific first), so
      // style-filtering only needs to live in the wildcard entry.
      "*": filterStyleAttribute,
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
    },
  }).trim();
}
