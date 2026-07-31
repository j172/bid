import { randomBytes } from "crypto";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { MAX_PHOTO_BYTES } from "@/lib/photoLimits";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedPhotoType(type: string): boolean {
  return type in ALLOWED_EXTENSIONS;
}

// Deliberately outside public/: `next start` appears to snapshot the public
// folder's contents at process boot, so files written there at runtime
// 404 until the next restart. These are served instead by
// app/uploads/[...path]/route.ts, which reads the filesystem per request.
export const UPLOADS_ROOT = join(process.cwd(), "uploads");

export async function saveListingPhotos(listingId: number, photos: File[]): Promise<string[]> {
  const dir = join(UPLOADS_ROOT, "listings", String(listingId));
  await mkdir(dir, { recursive: true });

  const fileNames: string[] = [];
  for (const photo of photos) {
    if (!isAllowedPhotoType(photo.type)) {
      throw new Error(`不支援的圖片格式：${photo.type || "unknown"}`);
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      throw new Error(`圖片檔案過大（上限 ${MAX_PHOTO_BYTES / 1024 / 1024}MB）`);
    }

    const extension = ALLOWED_EXTENSIONS[photo.type];
    const fileName = `${randomBytes(16).toString("hex")}.${extension}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    await writeFile(join(dir, fileName), buffer);
    fileNames.push(fileName);
  }

  return fileNames;
}

export function listingPhotoUrl(listingId: number, fileName: string): string {
  return `/uploads/listings/${listingId}/${fileName}`;
}

// Used when editing a listing's photos — removes files no longer kept in
// the new photo order. Best-effort: a file that's already gone (or never
// existed) is not an error worth failing the edit over.
export async function deleteListingPhotoFiles(listingId: number, fileNames: string[]): Promise<void> {
  const dir = join(UPLOADS_ROOT, "listings", String(listingId));
  for (const fileName of fileNames) {
    await unlink(join(dir, fileName)).catch(() => {});
  }
}

// Used by relistClosedListing (lib/listings.ts) so a re-listed auction
// doesn't force the admin to re-upload photos that already exist on disk
// under the original listing's own directory — same file names, copied
// into the new listing's directory.
export async function copyListingPhotos(fromListingId: number, toListingId: number, fileNames: string[]): Promise<void> {
  const fromDir = join(UPLOADS_ROOT, "listings", String(fromListingId));
  const toDir = join(UPLOADS_ROOT, "listings", String(toListingId));
  await mkdir(toDir, { recursive: true });
  for (const fileName of fileNames) {
    await copyFile(join(fromDir, fileName), join(toDir, fileName));
  }
}
