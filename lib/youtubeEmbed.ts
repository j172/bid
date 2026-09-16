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

// Shared validator for the standalone `youtube_url` field on products and
// listings (issue #286) — an optional "featured video" slot, separate from
// DescriptionEditor's inline "插入 YouTube 影片" button. Reuses
// extractYouTubeId rather than a second parser; empty is valid (the field is
// optional), same "blank means unset" rule as every other optional field in
// this app (e.g. loftId).
export function validateYoutubeUrl(url: string): FieldValidationResult {
  const trimmed = url.trim();
  if (trimmed === "") {
    return { ok: true };
  }
  if (!extractYouTubeId(trimmed)) {
    return { ok: false, error: "無效的 YouTube 網址，請確認包含正確的影片 ID" };
  }
  return { ok: true };
}

// Local re-declaration rather than importing from lib/richTextValidation.ts:
// that module is intentionally dependency-free (imported by client editor
// components too), and this file already has no runtime dependencies of its
// own — keeping it that way avoids giving either module a reason to import
// the other. Structurally identical to FieldValidationResult there.
export type FieldValidationResult = { ok: true } | { ok: false; error: string };
