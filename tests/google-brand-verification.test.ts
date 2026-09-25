import { describe, expect, it } from "vitest";
import zhTw from "@/messages/zh-TW.json";
import zhCn from "@/messages/zh-CN.json";
import en from "@/messages/en.json";

describe("Google Brand Verification and Transparency (#358)", () => {
  const locales = [
    { name: "zh-TW", messages: zhTw },
    { name: "zh-CN", messages: zhCn },
    { name: "en", messages: en },
  ] as const;

  const requiredHomeKeys = [
    "appPurposeEyebrow",
    "appPurposeTitle",
    "appPurposeBadgePublic",
    "appPurposeBadgeSecure",
    "appPurposeIntro",
    "appPurposeFeature1Title",
    "appPurposeFeature1Desc",
    "appPurposeFeature2Title",
    "appPurposeFeature2Desc",
    "appPurposeFeature3Title",
    "appPurposeFeature3Desc",
    "appPurposeFeature4Title",
    "appPurposeFeature4Desc",
    "appPurposePrivacyLink",
    "appPurposeTermsLink",
    "appPurposeFooterNote",
  ] as const;

  it.each(locales)("has all required home application purpose keys in $name", ({ messages }) => {
    const home = messages.home as Record<string, unknown>;
    for (const key of requiredHomeKeys) {
      expect(home[key], `Missing key home.${key}`).toBeDefined();
      expect(typeof home[key]).toBe("string");
      expect((home[key] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(locales)("includes Google API User Data Policy in privacyPage for $name", ({ messages }) => {
    const privacy = messages.privacyPage as {
      sections: Array<{ title: string; paragraphs: string[] }>;
    };
    expect(Array.isArray(privacy.sections)).toBe(true);

    const googleSection = privacy.sections.find(
      (s) =>
        s.title.includes("Google") ||
        s.paragraphs.some((p) => p.includes("Google API") || p.includes("Limited Use")),
    );

    expect(googleSection, "Expected privacy policy to contain a section covering Google API / Limited Use").toBeDefined();
    expect(googleSection!.paragraphs.length).toBeGreaterThanOrEqual(1);

    const fullText = googleSection!.paragraphs.join(" ");
    expect(fullText).toMatch(/Limited Use/i);
    expect(fullText).toMatch(/Google/i);
  });

  it("mentions Xiangshui Racing Pigeon Network in the home and privacy messages", () => {
    expect(zhTw.home.appPurposeIntro).toContain("翔水賽鴿網");
    expect(en.home.appPurposeIntro).toContain("Xiangshui Racing Pigeon Network");
    expect(zhTw.home.appPurposeFeature3Desc).toContain("Google");
    expect(en.home.appPurposeFeature3Desc).toContain("Google");
  });
});
