import { NextResponse } from "next/server";
import { buildLlmsTxt } from "@/lib/seo";

// /llms.txt (issue #107 item 8) — Next.js has no built-in convention for
// this file (unlike robots.ts/sitemap.ts), so a route handler under a
// literal "llms.txt" folder is the standard workaround: this folder name
// becomes the URL path verbatim. Content is static (no DB/request data), so
// this can be safely cached/pre-rendered.
export const dynamic = "force-static";

export function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
