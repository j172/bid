// Shared by TinyMCE editors' "insert video" dialogs (see
// app/z04urru6/listings/DescriptionEditor.tsx) that restrict video embedding
// to YouTube only (see the custom dialog registered there) rather than
// TinyMCE's built-in media plugin, whose multi-tab UI accepts raw embed
// code / arbitrary source URLs and would undermine that restriction.
const YOUTUBE_ID_PATTERN =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractYouTubeId(url: string): string | null {
  const match = url.trim().match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : null;
}
