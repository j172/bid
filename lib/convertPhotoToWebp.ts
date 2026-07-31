// Browser-only: converts an image File to WEBP via <canvas>.toBlob before
// it ever reaches the server. Deliberately NOT using a Node image library
// (sharp) or a WASM codec — this host has already crashed pm2 twice from
// WebAssembly.instantiate() running out of memory (see lib/email.ts's
// comment), and every real WEBP encoder is either a native binary or a
// WASM port of the same C library, so doing the conversion in the
// visitor's own browser is the only option with zero server-side risk.
//
// GIFs pass through unconverted — canvas can only capture a single static
// frame, which would silently destroy any animation. Any other failure
// (old browser, canvas/toBlob returning null, a corrupt image) also falls
// back to the original file rather than blocking the upload; this is a
// best-effort size optimization, not a correctness-critical control.

const WEBP_QUALITY = 0.85;

export async function convertPhotoToWebp(file: File): Promise<File> {
  if (file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], newName, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
