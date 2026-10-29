import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildLineAuthUrl,
  createLineAuthState,
  createLineOnboardToken,
  getLineConfig,
  getLineProfile,
  isLineConfigured,
  issueLineAccessToken,
  verifyLineAuthState,
  verifyLineIdToken,
  verifyLineOnboardToken,
  type LineConfig,
} from "./lineAuth";
import * as httpsModule from "./httpsRequest";

describe("lineAuth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("config", () => {
    it("returns null when channelId or channelSecret is missing", () => {
      delete process.env.LINE_CHANNEL_ID;
      delete process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
      delete process.env.LINE_CHANNEL_SECRET;

      expect(getLineConfig()).toBeNull();
      expect(isLineConfigured()).toBe(false);
    });

    it("returns parsed config when env variables are present", () => {
      process.env.LINE_CHANNEL_ID = "123456789";
      process.env.LINE_CHANNEL_SECRET = "secret-xyz";
      process.env.LINE_CALLBACK_URL = "https://example.com/callback";

      const config = getLineConfig();
      expect(config).toEqual({
        channelId: "123456789",
        channelSecret: "secret-xyz",
        callbackUrl: "https://example.com/callback",
      });
      expect(isLineConfigured()).toBe(true);
    });
  });

  describe("buildLineAuthUrl", () => {
    it("constructs official LINE authorization URL with correct parameters", () => {
      const config: LineConfig = {
        channelId: "123456789",
        channelSecret: "secret",
        callbackUrl: "https://example.com/callback",
      };
      const url = buildLineAuthUrl({
        config,
        state: "signed-state-123",
      });

      expect(url).toContain("https://access.line.me/oauth2/v2.1/authorize");
      expect(url).toContain("response_type=code");
      expect(url).toContain("client_id=123456789");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=signed-state-123");
      expect(url).toContain("scope=profile+openid+email");
    });
  });

  describe("state CSRF token", () => {
    it("creates and verifies a valid state with returnTo", () => {
      const state = createLineAuthState("/listings/42");
      const result = verifyLineAuthState(state);

      expect(result).not.toBeNull();
      expect(result?.returnTo).toBe("/listings/42");
    });

    it("defaults to root path if returnTo does not start with slash", () => {
      const state = createLineAuthState("javascript:alert(1)");
      const result = verifyLineAuthState(state);

      expect(result?.returnTo).toBe("/");
    });

    it("rejects tampered state string", () => {
      const state = createLineAuthState("/test");
      const tampered = state.slice(0, -4) + "abcd";

      expect(verifyLineAuthState(tampered)).toBeNull();
    });

    it("rejects malformed base64", () => {
      expect(verifyLineAuthState("invalid:state:format")).toBeNull();
    });
  });

  describe("issueLineAccessToken", () => {
    const config: LineConfig = {
      channelId: "123456789",
      channelSecret: "test-secret",
      callbackUrl: "https://example.com/api/auth/line/callback",
    };

    it("calls token endpoint with urlencoded body and parses response", async () => {
      const httpsSpy = vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 200,
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "Bearer",
          refresh_token: "mock-refresh-token",
          expires_in: 2592000,
          scope: "profile openid email",
          id_token: "mock-id-token",
        }),
      });

      const result = await issueLineAccessToken("auth-code-123", config.callbackUrl, config);

      expect(result).toEqual({
        access_token: "mock-access-token",
        token_type: "Bearer",
        refresh_token: "mock-refresh-token",
        expires_in: 2592000,
        scope: "profile openid email",
        id_token: "mock-id-token",
      });
      expect(httpsSpy).toHaveBeenCalledWith(
        "https://api.line.me/oauth2/v2.1/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );
    });

    it("returns null when status is not 200", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 400,
        body: JSON.stringify({ error: "invalid_grant" }),
      });

      const result = await issueLineAccessToken("bad-code", config.callbackUrl, config);
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockRejectedValue(new Error("Network timeout"));

      const result = await issueLineAccessToken("bad-code", config.callbackUrl, config);
      expect(result).toBeNull();
    });
  });

  describe("verifyLineIdToken", () => {
    it("successfully verifies ID token with channelId", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 200,
        body: JSON.stringify({
          iss: "https://access.line.me",
          sub: "U1234567890abcdef",
          aud: "123456789",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          name: "Test User",
          picture: "https://example.com/avatar.jpg",
          email: "user@example.com",
        }),
      });

      const payload = await verifyLineIdToken("mock-id-token", "123456789");

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe("U1234567890abcdef");
      expect(payload?.name).toBe("Test User");
      expect(payload?.email).toBe("user@example.com");
    });

    it("returns null if response status is not 200", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 400,
        body: JSON.stringify({ error: "invalid_token" }),
      });

      const payload = await verifyLineIdToken("bad-token", "123456789");
      expect(payload).toBeNull();
    });
  });

  describe("getLineProfile", () => {
    it("returns profile information from v2 endpoint", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 200,
        body: JSON.stringify({
          userId: "U4af4980629",
          displayName: "Line Brown",
          pictureUrl: "https://profile.line-scdn.net/xyz",
        }),
      });

      const profile = await getLineProfile("valid-access-token");
      expect(profile).toEqual({
        userId: "U4af4980629",
        displayName: "Line Brown",
        pictureUrl: "https://profile.line-scdn.net/xyz",
      });
    });

    it("returns null when request fails", async () => {
      vi.spyOn(httpsModule, "httpsRequest").mockResolvedValue({
        status: 401,
        body: "Unauthorized",
      });

      const profile = await getLineProfile("invalid-token");
      expect(profile).toBeNull();
    });
  });

  describe("onboarding cookie token", () => {
    it("signs and verifies onboarding data correctly", () => {
      const data = {
        lineUserId: "U999888777",
        displayName: "Pigeon Master",
        email: "pigeon@example.com",
        picture: "https://example.com/pic.jpg",
      };

      const token = createLineOnboardToken(data);
      const decoded = verifyLineOnboardToken(token);

      expect(decoded).toEqual(data);
    });

    it("rejects tampered onboarding token signature", () => {
      const token = createLineOnboardToken({ lineUserId: "U111" });
      const parts = token.split(".");
      const tampered = `${parts[0]}.wrongsignature123456`;

      expect(verifyLineOnboardToken(tampered)).toBeNull();
    });

    it("rejects malformed token", () => {
      expect(verifyLineOnboardToken("not-a-token")).toBeNull();
    });
  });
});
