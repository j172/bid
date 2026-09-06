import { NextResponse } from "next/server";
import { buildLlmsFullTxt } from "@/lib/seo";

// /llms-full.txt (issue #187) — Full documentation and markdown knowledge base
// for AI crawlers/agents (llmstxt.org convention). Static content, safe to pre-render.
export const dynamic = "force-static";

export function GET() {
  return new NextResponse(buildLlmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
