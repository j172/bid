import { extractYouTubeId } from "@/lib/youtubeEmbed";

interface YoutubeEmbedProps {
  /** Raw admin-entered URL (products.youtube_url / listings.youtube_url, issue #286) — parsed here rather than trusted as-is. */
  url: string;
  title: string;
  className?: string;
}

// Renders the standalone "featured video" slot on the public product/listing
// detail pages (issue #286) — separate from the inline <iframe> a seller can
// insert directly into a rich-text description via DescriptionEditor's own
// "插入 YouTube 影片" button. Same youtube-nocookie.com/embed/ domain and
// `allow` attributes as that button (see
// app/z04urru6/listings/DescriptionEditor.tsx) so both surfaces behave
// identically for the visitor. Renders nothing when the URL doesn't parse —
// callers should also skip rendering this component entirely when
// youtube_url is null, per this ticket's "no placeholder/empty state" rule.
export default function YoutubeEmbed({ url, title, className = "" }: YoutubeEmbedProps) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-xl border border-border bg-black ${className}`.trim()}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}
