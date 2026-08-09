// Renders operator-authored rich text (listing descriptions, 最新訊息 posts,
// 入賞鴿/進口鴿 write-ups).
//
// There is no @tailwindcss/typography plugin in this project, so rich-text
// tags are styled via explicit child selectors instead of a `prose` class.
// That ~500-character selector string used to be pasted verbatim into three
// places (ListingDetailTabs, the news detail page, the pigeon-showcase
// detail page), which meant a styling fix for, say, tables reached whichever
// of the three the author happened to be looking at (issue #139 item 7).
const RICH_TEXT_CLASS =
  "max-w-none [&_a]:text-interactive-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5";

interface RichTextContentProps {
  /**
   * Stored pre-sanitized — lib/sanitizeDescriptionHtml.ts is applied by both
   * the create and the edit API routes, so nothing sanitizes again here.
   * Never pass visitor-supplied HTML through this component.
   */
  html: string;
  /** Per-placement spacing/colour (margins, dividers, base text colour). */
  className?: string;
}

export default function RichTextContent({ html, className = "" }: RichTextContentProps) {
  return (
    <div
      className={`${className} ${RICH_TEXT_CLASS}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
