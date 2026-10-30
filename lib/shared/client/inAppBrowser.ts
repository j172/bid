// In-app browser detection and device platform helpers.
// Used to warn visitors when opening the site inside social app WebViews
// (LINE, Facebook, Instagram, WeChat, etc.) where Google One Tap / OAuth,
// Passkey WebAuthn, and real-time WebSockets often fail or get blocked.

export type DevicePlatform = "ios" | "android" | "other";

/**
 * Detects whether the User Agent string belongs to an embedded in-app browser
 * (WebView) such as LINE, Facebook, Instagram, WeChat, TikTok, or generic WebViews.
 */
export function isInAppBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const userAgent = ua.toLowerCase();

  // LINE
  if (userAgent.includes("line/")) return true;

  // Facebook & Messenger (FBAN, FBAV, FB_IAB, FB4A)
  if (
    userAgent.includes("fban") ||
    userAgent.includes("fbav") ||
    userAgent.includes("fb_iab") ||
    userAgent.includes("fb4a")
  ) {
    return true;
  }

  // Instagram
  if (userAgent.includes("instagram")) return true;

  // WeChat / MicroMessenger
  if (userAgent.includes("micromessenger")) return true;

  // TikTok / ByteDance
  if (
    userAgent.includes("musical_ly") ||
    userAgent.includes("bytedance") ||
    userAgent.includes("tiktok")
  ) {
    return true;
  }

  // Android WebView indicators
  if (
    userAgent.includes("; wv") ||
    (userAgent.includes("android") && userAgent.includes("version/") && !userAgent.includes("chrome/"))
  ) {
    return true;
  }

  return false;
}

/**
 * Identifies the high-level operating system platform for tailored instructions
 * (Safari on iOS vs Chrome on Android).
 */
export function getDevicePlatform(ua: string | null | undefined): DevicePlatform {
  if (!ua) return "other";
  const userAgent = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "other";
}
