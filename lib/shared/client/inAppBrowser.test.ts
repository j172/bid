import { describe, expect, it } from "vitest";
import { getDevicePlatform, isInAppBrowser } from "./inAppBrowser";

describe("inAppBrowser", () => {
  describe("isInAppBrowser", () => {
    it("returns false for standard desktop Chrome", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(isInAppBrowser(ua)).toBe(false);
    });

    it("returns false for standard mobile Safari on iOS", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      expect(isInAppBrowser(ua)).toBe(false);
    });

    it("returns false for empty or undefined userAgent", () => {
      expect(isInAppBrowser("")).toBe(false);
      expect(isInAppBrowser(undefined)).toBe(false);
      expect(isInAppBrowser(null)).toBe(false);
    });

    it("detects LINE in-app browser", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.8.1";
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it("detects Facebook app (FBAN / FBAV)", () => {
      const ua = "Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/420.0.0.32.62;]";
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it("detects Instagram in-app browser", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20B82 Instagram 260.0.0.21.109";
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it("detects WeChat (MicroMessenger)", () => {
      const ua = "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A.210817.037; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/94.0.4606.85 Mobile Safari/537.36 MicroMessenger/8.0.18";
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it("detects TikTok / ByteDance", () => {
      const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_26.1.3";
      expect(isInAppBrowser(ua)).toBe(true);
    });

    it("detects Android WebView (; wv)", () => {
      const ua = "Mozilla/5.0 (Linux; U; Android 10; zh-tw; Redmi Note 8 Pro Build/QP1A.190711.020; wv) AppleWebKit/537.36";
      expect(isInAppBrowser(ua)).toBe(true);
    });
  });

  describe("getDevicePlatform", () => {
    it("identifies iOS devices", () => {
      expect(getDevicePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
      expect(getDevicePlatform("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("ios");
    });

    it("identifies Android devices", () => {
      expect(getDevicePlatform("Mozilla/5.0 (Linux; Android 13; Pixel 7)")).toBe("android");
    });

    it("returns other for desktop or unknown UA", () => {
      expect(getDevicePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
      expect(getDevicePlatform("")).toBe("other");
      expect(getDevicePlatform(null)).toBe("other");
    });
  });
});
