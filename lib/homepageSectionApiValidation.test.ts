// resolveBio (issue #315): covers the one behavior change that matters most
// here — it must NOT sanitize a 'featured_loft' bio itself, since the raw
// value can still contain DescriptionEditor/SimpleRichTextEditor's `cid:N`
// inline-image placeholders that haven't been resolved to real /uploads/...
// URLs yet. lib/sanitizeDescriptionHtml.ts only allows http/https img src
// values, so sanitizing before that resolution would silently strip the
// image entirely — see this file's own comment on resolveBio for the full
// story. The API routes are responsible for resolving + sanitizing
// afterward (see app/api/admin/homepage-sections/route.ts).
//
// getHomepageSectionById is mocked since resolveLinkedLoftId (not exercised
// here) is the only other export that touches the DB — resolveBio itself is
// pure.

import { describe, expect, it, vi } from "vitest";
import { resolveBio } from "./homepageSectionApiValidation";

vi.mock("@/lib/homepageSections", () => ({
  getHomepageSectionById: vi.fn(),
}));

describe("resolveBio", () => {
  it("treats an empty string as no bio at all", () => {
    expect(resolveBio("partner_loft", "")).toEqual({ ok: true, bio: null });
    expect(resolveBio("featured_loft", "")).toEqual({ ok: true, bio: null });
  });

  it("returns a 'partner_loft' bio raw (plain-text field, never sanitized)", () => {
    const raw = "<script>alert(1)</script>合作鴿舍簡介";
    expect(resolveBio("partner_loft", raw)).toEqual({ ok: true, bio: raw });
  });

  it("validates a 'featured_loft' bio but returns it raw, cid: placeholders intact", () => {
    const raw = '<p>內容</p><img src="cid:0">';
    const result = resolveBio("featured_loft", raw);
    expect(result).toEqual({ ok: true, bio: raw });
  });

  it("rejects a 'featured_loft' bio that's over the visible-text cap", () => {
    const raw = `<p>${"字".repeat(2001)}</p>`;
    const result = resolveBio("featured_loft", raw);
    expect(result.ok).toBe(false);
  });

  it("rejects a 'featured_loft' bio that's markup with no visible text", () => {
    const result = resolveBio("featured_loft", "<p></p><br>");
    expect(result).toEqual({ ok: false, error: "請輸入內容" });
  });
});
