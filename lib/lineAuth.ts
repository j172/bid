import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { httpsRequest } from "@/lib/httpsRequest";
import { resolveSiteUrl } from "@/lib/siteUrl";

export interface LineConfig {
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
}

export interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export interface LineIdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
}

export interface LineOnboardData {
  lineUserId: string;
  displayName?: string;
  email?: string;
  picture?: string;
}

export const LINE_AUTH_STATE_COOKIE = "line_auth_state";
export const LINE_ONBOARD_COOKIE = "line_onboard";
export const LINE_AUTH_STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const LINE_ONBOARD_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getLineConfig(): LineConfig | null {
  const channelId = process.env.LINE_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    return null;
  }
  const callbackUrl = process.env.LINE_CALLBACK_URL || `${resolveSiteUrl()}/api/auth/line/callback`;
  return {
    channelId: channelId.trim(),
    channelSecret: channelSecret.trim(),
    callbackUrl: callbackUrl.trim(),
  };
}

export function isLineConfigured(): boolean {
  return Boolean(
    (process.env.LINE_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_CHANNEL_ID) &&
      process.env.LINE_CHANNEL_SECRET,
  );
}

function getHmacSecret(): string {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "bid-line-challenge-secret";
}

/**
 * Builds the LINE Login OAuth 2.0 authorization URL.
 * Reference: https://developers.line.biz/en/docs/line-login/integrate-line-login/#making-an-authorization-request
 */
export function buildLineAuthUrl(options: {
  config: LineConfig;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: options.config.channelId,
    redirect_uri: options.config.callbackUrl,
    state: options.state,
    scope: options.scope || "profile openid email",
    prompt: "consent",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/**
 * Creates a signed state string containing random entropy, returnTo destination, and expiry timestamp.
 */
export function createLineAuthState(returnTo: string = "/"): string {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + LINE_AUTH_STATE_TTL_MS;
  const safeReturnTo = Buffer.from(returnTo).toString("base64url");
  const payload = `${nonce}:${safeReturnTo}:${expiresAt}`;
  const signature = createHmac("sha256", getHmacSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/**
 * Verifies a signed state string and returns the decoded returnTo path if valid.
 */
export function verifyLineAuthState(state: string): { returnTo: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [nonce, safeReturnTo, expiresAtStr, signature] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!nonce || !safeReturnTo || !expiresAt || isNaN(expiresAt) || !signature) {
      return null;
    }

    if (Date.now() > expiresAt) {
      return null;
    }

    const payload = `${nonce}:${safeReturnTo}:${expiresAt}`;
    const expected = createHmac("sha256", getHmacSecret()).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const returnTo = Buffer.from(safeReturnTo, "base64url").toString("utf8");
    return { returnTo: returnTo.startsWith("/") ? returnTo : "/" };
  } catch {
    return null;
  }
}

/**
 * Exchanges authorization code for access_token and id_token.
 * Reference: https://developers.line.biz/en/reference/line-login/#issue-access-token
 */
export async function issueLineAccessToken(
  code: string,
  redirectUri: string,
  config: LineConfig,
): Promise<LineTokenResponse | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.channelId,
    client_secret: config.channelSecret,
  }).toString();

  try {
    const res = await httpsRequest("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      timeoutMs: 10000,
    });

    if (res.status !== 200) {
      return null;
    }

    return JSON.parse(res.body) as LineTokenResponse;
  } catch {
    return null;
  }
}

/**
 * Verifies an ID token using LINE's verify endpoint.
 * Reference: https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
export async function verifyLineIdToken(
  idToken: string,
  channelId: string,
): Promise<LineIdTokenPayload | null> {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: channelId,
  }).toString();

  try {
    const res = await httpsRequest("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      timeoutMs: 10000,
    });

    if (res.status !== 200) {
      return null;
    }

    const payload = JSON.parse(res.body) as LineIdTokenPayload;
    if (!payload.sub) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves user profile directly from LINE API v2.
 * Reference: https://developers.line.biz/en/reference/line-login/#get-user-profile
 */
export async function getLineProfile(
  accessToken: string,
): Promise<{ userId: string; displayName: string; pictureUrl?: string } | null> {
  try {
    const res = await httpsRequest("https://api.line.me/v2/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeoutMs: 10000,
    });

    if (res.status !== 200) {
      return null;
    }

    const data = JSON.parse(res.body);
    if (!data.userId) return null;
    return {
      userId: data.userId,
      displayName: data.displayName || "",
      pictureUrl: data.pictureUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Signs an onboarding payload to be stored in an HttpOnly cookie for registration completion.
 */
export function createLineOnboardToken(data: LineOnboardData): string {
  const expiresAt = Date.now() + LINE_ONBOARD_TTL_MS;
  const rawPayload = JSON.stringify({ ...data, expiresAt });
  const b64Payload = Buffer.from(rawPayload, "utf8").toString("base64url");
  const signature = createHmac("sha256", getHmacSecret()).update(b64Payload).digest("hex");
  return `${b64Payload}.${signature}`;
}

/**
 * Verifies and decodes an onboarding token from cookie.
 */
export function verifyLineOnboardToken(token: string): LineOnboardData | null {
  try {
    const [b64Payload, signature] = token.split(".");
    if (!b64Payload || !signature) return null;

    const expected = createHmac("sha256", getHmacSecret()).update(b64Payload).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf8"));
    if (!data.lineUserId || typeof data.expiresAt !== "number") {
      return null;
    }

    if (Date.now() > data.expiresAt) {
      return null;
    }

    return {
      lineUserId: data.lineUserId,
      displayName: data.displayName,
      email: data.email,
      picture: data.picture,
    };
  } catch {
    return null;
  }
}
