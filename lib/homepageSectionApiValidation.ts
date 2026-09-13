// Section-type-specific validation for the homepage_sections admin API
// routes (app/api/admin/homepage-sections/route.ts and [id]/route.ts) —
// deliberately NOT in lib/homepageSections.ts, which stays
// section-type-agnostic (see that module's header comment). Both routes
// share this so the two HTTP verbs (POST create, PATCH edit) can't drift
// apart on what a 'featured_loft' row requires.

import { getHomepageSectionById } from "@/lib/homepageSections";
import { validateRichTextField } from "@/lib/richTextValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";

export const BIO_MAX = 2000;
// 'featured_loft' (名家專區, issue #270) authors its bio/內容 field as rich
// text (SimpleRichTextEditor) rather than the plain-text textarea
// 'partner_loft' uses for 簡介, so it needs its own visible-text/raw-HTML
// caps — copied from the removed lib/featuredLoftPostValidation.ts's
// CONTENT_MAX/CONTENT_HTML_MAX (issue #176) rather than reusing BIO_MAX,
// which measures raw string length, not visible text.
export const FEATURED_LOFT_CONTENT_MAX = 2000;
export const FEATURED_LOFT_CONTENT_HTML_MAX = 20_000;

export type LinkedLoftResult = { ok: true; linkedLoftId: number | null } | { ok: false; error: string };

// 'featured_loft' rows require a linkedLoftId that resolves to an existing
// 'partner_loft' row; every other section_type ignores whatever was sent
// and always stores null.
export async function resolveLinkedLoftId(sectionType: string, raw: string): Promise<LinkedLoftResult> {
  if (sectionType !== "featured_loft") {
    return { ok: true, linkedLoftId: null };
  }
  const linkedLoftId = raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(linkedLoftId) || !Number.isInteger(linkedLoftId) || linkedLoftId <= 0) {
    return { ok: false, error: "請選擇關聯鴿舍" };
  }
  const linkedLoft = await getHomepageSectionById(linkedLoftId);
  if (!linkedLoft || linkedLoft.sectionType !== "partner_loft") {
    return { ok: false, error: "找不到這個合作鴿舍" };
  }
  return { ok: true, linkedLoftId };
}

export type BioResult = { ok: true; bio: string | null } | { ok: false; error: string };

// 'featured_loft' rows' bio/內容 field is rich text (sanitized + measured
// against the visible-text/raw-HTML caps above); every other section_type
// keeps the plain-text BIO_MAX check. Optional either way — an empty field
// means "no bio/內容", not a validation error.
export function resolveBio(sectionType: string, raw: string): BioResult {
  if (raw === "") {
    return { ok: true, bio: null };
  }
  if (sectionType === "featured_loft") {
    const result = validateRichTextField(raw, {
      emptyError: "請輸入內容",
      tooLongHtmlError: "內容過長",
      tooLongTextError: `內容不能超過 ${FEATURED_LOFT_CONTENT_MAX} 個字`,
      htmlMax: FEATURED_LOFT_CONTENT_HTML_MAX,
      textMax: FEATURED_LOFT_CONTENT_MAX,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, bio: sanitizeDescriptionHtml(raw) };
  }
  if (raw.length > BIO_MAX) {
    return { ok: false, error: `簡介上限 ${BIO_MAX} 字` };
  }
  return { ok: true, bio: raw };
}
