// Photo re-ordering payload for the product admin CRUD (issue #277) —
// app/api/admin/products/route.ts (create) and .../[id]/route.ts (edit).
// Mirrors lib/listingPhotoOrder.ts's PhotoOrderEntry/parsePhotoOrder/
// resolvePhotoOrder byte-for-byte (same shape-validation-before-any-disk-write
// reasoning — see that file's header comment), plus one addition: each entry
// also carries `isCover` (which photo ProductPhotoGalleryEditor.tsx has
// designated as the 封面圖), since products need an explicit, independently-
// chosen cover photo rather than "whichever photo sorts first" (see
// db/init.sql's product_photos.is_cover comment for why that differs from
// listing_photos).
//
// Kept as its own copy rather than generalizing lib/listingPhotoOrder.ts with
// an optional isCover field: listings have no cover concept at all, and
// threading an unused field through that module's callers/tests only to
// support this one, unrelated table isn't worth the coupling.

export type ProductPhotoOrderEntry =
  | { type: "existing"; fileName: string; isCover: boolean }
  | { type: "new"; index: number; isCover: boolean };

function isProductPhotoOrderEntry(value: unknown): value is ProductPhotoOrderEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { type?: unknown; fileName?: unknown; index?: unknown; isCover?: unknown };
  if (typeof entry.isCover !== "boolean") return false;
  if (entry.type === "existing") {
    return typeof entry.fileName === "string" && entry.fileName.length > 0;
  }
  if (entry.type === "new") {
    return typeof entry.index === "number" && Number.isSafeInteger(entry.index) && entry.index >= 0;
  }
  return false;
}

// Shape-only validation, run before anything is written to disk: valid JSON,
// an array, and every entry one of the two known variants with a boolean
// isCover. Returns null for anything else so the caller can answer 400
// without a thrown parse error.
export function parseProductPhotoOrder(raw: string): ProductPhotoOrderEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (!parsed.every(isProductPhotoOrderEntry)) return null;
  return parsed;
}

export interface ResolvedProductPhoto {
  fileName: string;
  isCover: boolean;
}

// Resolves the validated order into the final list of {fileName, isCover} to
// store, same "existing must be one of this product's real photos, new must
// point at a file this request actually saved" cross-check as
// lib/listingPhotoOrder.ts's resolvePhotoOrder. Also normalizes isCover so
// exactly one resolved photo ends up covered: if the client marked none
// (shouldn't normally happen — the editor always keeps one selected), the
// first photo is promoted; if it marked more than one (a stale/tampered
// request), only the first marked one is kept. Never returns an empty list
// with more than one isCover: true.
export function resolveProductPhotoOrder(
  order: ProductPhotoOrderEntry[],
  existingFileNames: string[],
  newFileNames: string[],
): ResolvedProductPhoto[] | null {
  const existing = new Set(existingFileNames);
  const resolved: ResolvedProductPhoto[] = [];
  for (const entry of order) {
    if (entry.type === "existing") {
      if (!existing.has(entry.fileName)) return null;
      resolved.push({ fileName: entry.fileName, isCover: entry.isCover });
    } else {
      if (entry.index >= newFileNames.length) return null;
      resolved.push({ fileName: newFileNames[entry.index], isCover: entry.isCover });
    }
  }

  const coverIndex = resolved.findIndex((photo) => photo.isCover);
  if (coverIndex === -1) {
    if (resolved.length > 0) resolved[0] = { ...resolved[0], isCover: true };
  } else {
    for (let i = 0; i < resolved.length; i++) {
      if (i !== coverIndex && resolved[i].isCover) {
        resolved[i] = { ...resolved[i], isCover: false };
      }
    }
  }

  return resolved;
}
