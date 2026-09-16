import { describe, expect, it } from "vitest";
import { extractYouTubeId, validateYoutubeUrl } from "./youtubeEmbed";

describe("extractYouTubeId", () => {
  it("parses a watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses a youtu.be short URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(extractYouTubeId("https://example.com/video")).toBeNull();
  });
});

// Shared validator for the products/listings `youtube_url` field (issue
// #286) — an optional "featured video" slot, distinct from
// DescriptionEditor's inline insert-video button.
describe("validateYoutubeUrl", () => {
  it("accepts a blank value (field is optional)", () => {
    expect(validateYoutubeUrl("")).toEqual({ ok: true });
    expect(validateYoutubeUrl("   ")).toEqual({ ok: true });
  });

  it("accepts a valid YouTube URL", () => {
    expect(validateYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ ok: true });
  });

  it("rejects a non-empty value that isn't a valid YouTube URL", () => {
    const result = validateYoutubeUrl("https://example.com/not-youtube");
    expect(result.ok).toBe(false);
  });
});
