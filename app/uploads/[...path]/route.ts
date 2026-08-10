import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { resolveUploadPath } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  // Path-traversal containment lives in lib/uploads.ts's resolveUploadPath
  // (issue #140 L-2) — null means the request escaped UPLOADS_ROOT.
  const resolved = resolveUploadPath(segments);

  if (resolved === null) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(resolved);
    const extension = segments.join("/").split(".").pop()?.toLowerCase() ?? "";
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
