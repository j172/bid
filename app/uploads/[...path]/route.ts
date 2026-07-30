import { readFile } from "fs/promises";
import { join, normalize } from "path";
import { NextResponse } from "next/server";
import { UPLOADS_ROOT } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const resolved = normalize(join(UPLOADS_ROOT, relative));

  if (!resolved.startsWith(UPLOADS_ROOT)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(resolved);
    const extension = relative.split(".").pop()?.toLowerCase() ?? "";
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
