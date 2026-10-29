import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createLineOnboardToken,
  getLineConfig,
  getLineProfile,
  issueLineAccessToken,
  LINE_AUTH_STATE_COOKIE,
  LINE_ONBOARD_COOKIE,
  LINE_ONBOARD_TTL_MS,
  verifyLineAuthState,
  verifyLineIdToken,
} from "@/lib/lineAuth";
import {
  createSession,
  findUserByLineUserId,
  getCurrentUser,
  linkLineUserId,
} from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(LINE_AUTH_STATE_COOKIE)?.value;

  if (error || !code || !state || !stateCookie || stateCookie !== state) {
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/login?error=LINE_AUTH_FAILED", url.origin));
  }

  const verifiedState = verifyLineAuthState(state);
  if (!verifiedState) {
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/login?error=LINE_AUTH_FAILED", url.origin));
  }

  const config = getLineConfig();
  if (!config) {
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/login?error=LINE_NOT_CONFIGURED", url.origin));
  }

  const tokenResponse = await issueLineAccessToken(code, config.callbackUrl, config);
  if (!tokenResponse?.id_token) {
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/login?error=LINE_AUTH_FAILED", url.origin));
  }

  const idTokenPayload = await verifyLineIdToken(tokenResponse.id_token, config.channelId);
  if (!idTokenPayload?.sub) {
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/login?error=LINE_AUTH_FAILED", url.origin));
  }

  let displayName = idTokenPayload.name;
  let picture = idTokenPayload.picture;
  if (!displayName || !picture) {
    const profile = await getLineProfile(tokenResponse.access_token);
    displayName = displayName || profile?.displayName;
    picture = picture || profile?.pictureUrl;
  }

  // 1. If this LINE user ID is already linked, log them in directly (skip 2FA per agreed decision).
  const existingUser = await findUserByLineUserId(idTokenPayload.sub);
  if (existingUser) {
    if (existingUser.suspended_at !== null) {
      cookieStore.delete(LINE_AUTH_STATE_COOKIE);
      return NextResponse.redirect(new URL("/login?error=ACCOUNT_SUSPENDED", url.origin));
    }

    await createSession(existingUser.id);
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL(verifiedState.returnTo, url.origin));
  }

  // 2. If a user is already logged in, they are linking LINE from their /account settings page.
  const currentUser = await getCurrentUser();
  if (currentUser) {
    await linkLineUserId(currentUser.id, idTokenPayload.sub);
    cookieStore.delete(LINE_AUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/account?lineLinked=true", url.origin));
  }

  // 3. New user onboarding flow: store verified identity in HttpOnly signed cookie.
  const onboardToken = createLineOnboardToken({
    lineUserId: idTokenPayload.sub,
    displayName,
    email: idTokenPayload.email,
    picture,
  });

  cookieStore.set(LINE_ONBOARD_COOKIE, onboardToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(LINE_ONBOARD_TTL_MS / 1000),
  });

  cookieStore.delete(LINE_AUTH_STATE_COOKIE);
  return NextResponse.redirect(new URL("/register/line", url.origin));
}
