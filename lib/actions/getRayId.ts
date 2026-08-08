"use server";

import { headers } from "next/headers";
import { resolveRayId } from "@/lib/rayId";

// app/[locale]/error.tsx and app/global-error.tsx must be Client Components
// (Next.js App Router requirement for error boundaries), so they have no
// direct access to request headers and can't call resolveRayId() (which
// needs next/headers' headers(), a server-only API) themselves. Mirrors
// lib/actions/getClientIp.ts's getClientIpAction — a Server Action rather
// than a new app/api/** route, called once after mounting to fill in the
// "Ray ID" line on the Cloudflare-styled error page. See issue #127.
export async function getRayIdAction(): Promise<string> {
  const headersList = await headers();
  return resolveRayId(headersList);
}
