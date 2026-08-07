import { randomBytes } from "crypto";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { DESCRIPTION_IMAGE_MAX_BYTES } from "@/lib/descriptionImageLimits";
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

// Images inserted inline into a listing's rich-text description (see
// DescriptionEditor) — stored under their own subdirectory, separate from
// the main photo gallery, since the two have independent count/size limits
// (lib/descriptionImageLimits.ts) and aren't part of listing_photos.
export async function saveDescriptionImages(listingId: number, images: File[]): Promise<string[]> {
  const dir = join(UPLOADS_ROOT, "listings", String(listingId), "description");
  await mkdir(dir, { recursive: true });

  const fileNames: string[] = [];
  for (const image of images) {
    if (!isAllowedPhotoType(image.type)) {
      throw new Error(`不支援的圖片格式：${image.type || "unknown"}`);
    }
    if (image.size > DESCRIPTION_IMAGE_MAX_BYTES) {
      throw new Error(`描述圖片過大（上限 ${DESCRIPTION_IMAGE_MAX_BYTES / 1024 / 1024}MB）`);
    }

    const extension = ALLOWED_EXTENSIONS[image.type];
    const fileName = `${randomBytes(16).toString("hex")}.${extension}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(dir, fileName), buffer);
    fileNames.push(fileName);
  }

  return fileNames;
}

export function descriptionImageUrl(listingId: number, fileName: string): string {
  return `/uploads/listings/${listingId}/description/${fileName}`;
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

// Shared by every single-image CMS upload below (homepage sections) — same
// validation/naming/storage scheme as saveListingPhotos' per-photo loop body,
// just factored out since these callers each only ever save exactly one file
// at a time. Browser-side callers should run the file through
// convertPhotoToWebp (lib/convertPhotoToWebp.ts) before upload, same as the
// listing photo picker does — this function itself doesn't re-encode.
async function saveSingleImage(dir: string, image: File): Promise<string> {
  if (!isAllowedPhotoType(image.type)) {
    throw new Error(`不支援的圖片格式：${image.type || "unknown"}`);
  }
  if (image.size > MAX_PHOTO_BYTES) {
    throw new Error(`圖片檔案過大（上限 ${MAX_PHOTO_BYTES / 1024 / 1024}MB）`);
  }

  await mkdir(dir, { recursive: true });
  const extension = ALLOWED_EXTENSIONS[image.type];
  const fileName = `${randomBytes(16).toString("hex")}.${extension}`;
  const buffer = Buffer.from(await image.arrayBuffer());
  await writeFile(join(dir, fileName), buffer);
  return fileName;
}

// homepage_sections (合作鴿舍 etc. — see lib/homepageSections.ts) — one
// image per row, flat directory since there's no per-row id yet at upload
// time (unlike listing photos, which are keyed by an already-inserted
// listing id).
export async function saveHomepageSectionImage(image: File): Promise<string> {
  return saveSingleImage(join(UPLOADS_ROOT, "homepage-sections"), image);
}

export function homepageSectionImageUrl(fileName: string): string {
  return `/uploads/homepage-sections/${fileName}`;
}

export async function deleteHomepageSectionImageFile(fileName: string): Promise<void> {
  await unlink(join(UPLOADS_ROOT, "homepage-sections", fileName)).catch(() => {});
}

// pigeon_showcase (issue #70's 主圖 addition) — same flat single-image
// storage scheme as saveHomepageSectionImage above. Unlike homepage
// sections' image (optional to replace on edit), the admin form requires an
// upload on every create/edit (PigeonShowcaseFormModal.tsx), so callers never
// need to fall back to an existing file name mid-request.
export async function savePigeonShowcaseImage(image: File): Promise<string> {
  return saveSingleImage(join(UPLOADS_ROOT, "pigeon-showcase"), image);
}

export function pigeonShowcaseImageUrl(fileName: string): string {
  return `/uploads/pigeon-showcase/${fileName}`;
}

export async function deletePigeonShowcaseImageFile(fileName: string): Promise<void> {
  await unlink(join(UPLOADS_ROOT, "pigeon-showcase", fileName)).catch(() => {});
}

// news_posts (issue #70's 主圖 addition) — same story as
// savePigeonShowcaseImage above, just its own subdirectory.
export async function saveNewsImage(image: File): Promise<string> {
  return saveSingleImage(join(UPLOADS_ROOT, "news"), image);
}

export function newsImageUrl(fileName: string): string {
  return `/uploads/news/${fileName}`;
}

export async function deleteNewsImageFile(fileName: string): Promise<void> {
  await unlink(join(UPLOADS_ROOT, "news", fileName)).catch(() => {});
}
