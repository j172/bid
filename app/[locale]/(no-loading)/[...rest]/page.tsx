import { notFound } from "next/navigation";

// Next.js's App Router only invokes a segment's not-found.tsx (see
// ../../not-found.tsx) when the URL actually matches down into that segment —
// an otherwise-unmatched path like /en/some-typo never matches any page
// file under [locale] (there's no other catch-all here), so without this
// file Next falls all the way back to its own generic built-in 404 instead
// of the site's Cloudflare-styled one. This catch-all page exists purely so
// any such path *does* match something inside [locale], which then calls
// notFound() to correctly trigger ../../not-found.tsx. This is next-intl's
// own documented fix for this exact gap (see their "Rendering a
// locale-specific 404 page" docs) — see issue #65.
//
// This route lives in the (no-loading) route group (issue #74) rather than
// directly under app/[locale]/ — [locale]'s loading.tsx (now inside the
// sibling (with-loading) group, alongside the homepage) wraps its whole
// subtree in a Suspense boundary, which makes Next.js stream a 200 status
// before this notFound() call downstream could take effect. Route groups
// are transparent to the URL, so this is still just /[locale]/<anything>.
export default function CatchAll() {
  notFound();
}
