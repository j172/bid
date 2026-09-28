import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildLineAuthUrl,
  createLineAuthState,
  getLineConfig,
  LINE_AUTH_STATE_COOKIE,
  LINE_AUTH_STATE_TTL_MS,
} from "@/lib/lineAuth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";

  const config = getLineConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=LINE_NOT_CONFIGURED", url.origin));
  }

  const state = createLineAuthState(returnTo);
  const authUrl = buildLineAuthUrl({ config, state });

  const cookieStore = await cookies();
  cookieStore.set(LINE_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(LINE_AUTH_STATE_TTL_MS / 1000),
  });

  return NextResponse.redirect(authUrl);
}
