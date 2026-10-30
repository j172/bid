// Photo re-ordering payload for app/api/admin/listings/[id]/edit (issue
// #139 M3). EditListingModal sends the gallery's final order as a JSON array
// mixing photos that already exist on the listing (referenced by file name)
// with the files being uploaded in this same request (referenced by their
// position in the `photos` field).
//
// The route used to accept that array after checking only `Array.isArray`,
// then index straight into the freshly-saved file names — so an entry with
// an out-of-range `index` (or a `type` that was neither of the two expected
// values) silently produced `undefined`, which was then written into
// listing_photos as the listing's photo order. Both halves are validated
// here instead, and both live in one pure, directly-testable module rather
// than inline in the handler.

export type PhotoOrderEntry = { type: "existing"; fileName: string } | { type: "new"; index: number };

function isPhotoOrderEntry(value: unknown): value is PhotoOrderEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { type?: unknown; fileName?: unknown; index?: unknown };
  if (entry.type === "existing") {
    return typeof entry.fileName === "string" && entry.fileName.length > 0;
  }
  if (entry.type === "new") {
    return typeof entry.index === "number" && Number.isSafeInteger(entry.index) && entry.index >= 0;
  }
  return false;
}

// Shape-only validation, run before anything is written to disk: valid JSON,
// an array, and every entry one of the two known variants. Returns null for
// anything else so the caller can answer 400 without a thrown parse error.
export function parsePhotoOrder(raw: string): PhotoOrderEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (!parsed.every(isPhotoOrderEntry)) return null;
  return parsed;
}

// Resolves the validated order into the final list of file names to store.
// `existing` entries must name a photo the listing actually has right now
// (no re-attaching another listing's file), and `new` entries must point at
// a file that really was saved by this request — returns null on either, so
// an out-of-range index can never reach the DB as `undefined`.
export function resolvePhotoOrder(
  order: PhotoOrderEntry[],
  existingFileNames: string[],
  newFileNames: string[],
): string[] | null {
  const existing = new Set(existingFileNames);
  const resolved: string[] = [];
  for (const entry of order) {
    if (entry.type === "existing") {
      if (!existing.has(entry.fileName)) return null;
      resolved.push(entry.fileName);
    } else {
      if (entry.index >= newFileNames.length) return null;
      resolved.push(newFileNames[entry.index]);
    }
  }
  return resolved;
}
