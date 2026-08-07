"use server";

import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/clientIp";

// app/[locale]/error.tsx and app/global-error.tsx must be Client Components
// (Next.js App Router requirement for error boundaries), so they have no
// direct access to request headers. A Server Action is used instead of a
// new app/api/** route so this stays completely outside the app/api tree
// that issue #65 is scoped to leave untouched — it's not a JSON REST
// endpoint, just an RPC the error boundary calls once after mounting to
// fill in the "Your IP" line on the Cloudflare-styled error page.
export async function getClientIpAction(): Promise<string | null> {
  const headersList = await headers();
  return getClientIpFromHeaders(headersList);
}
