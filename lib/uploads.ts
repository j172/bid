import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB per photo

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
      throw new Error("圖片檔案過大（上限 8MB）");
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
