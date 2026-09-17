import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  createHomepageSection,
  deleteHomepageSection,
  listHomepageSections,
  updateHomepageSectionBio,
} from "@/lib/homepageSections";
import { resolveBio, resolveLinkedLoftId } from "@/lib/homepageSectionApiValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteHomepageSectionImageFile,
  descriptionImageUrl,
  homepageSectionImageUrl,
  saveDescriptionImages,
  saveHomepageSectionImage,
} from "@/lib/uploads";

const TITLE_MAX = 255;
const SECTION_TYPE_MAX = 30;

// Admin list view for a given section_type (e.g. 'partner_loft' / 合作鴿舍)
// — includes inactive rows by default so admins can re-enable them; pass
// ?activeOnly=1 for the same active-only view the public homepage uses.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const sectionType = searchParams.get("sectionType")?.trim() ?? "";
  if (!sectionType) {
    return NextResponse.json({ ok: false, error: "缺少 sectionType 參數" }, { status: 400 });
  }
  const activeOnly = searchParams.get("activeOnly") === "1";

  const sections = await listHomepageSections(sectionType, { activeOnly });
  return NextResponse.json({
    ok: true,
    sections: sections.map((section) => ({ ...section, imageUrl: homepageSectionImageUrl(section.imageFileName) })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const form = await request.formData();
  const sectionType = String(form.get("sectionType") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const bioRaw = String(form.get("bio") ?? "").trim();
  const linkedLoftIdRaw = String(form.get("linkedLoftId") ?? "").trim();
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const image = form.get("image");
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!sectionType || sectionType.length > SECTION_TYPE_MAX) {
    return NextResponse.json({ ok: false, error: "sectionType 不正確" }, { status: 400 });
  }
  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入標題（上限 ${TITLE_MAX} 字）` }, { status: 400 });
  }
  const bioResult = resolveBio(sectionType, bioRaw);
  if (!bioResult.ok) {
    return NextResponse.json({ ok: false, error: bioResult.error }, { status: 400 });
  }
  const linkedLoftResult = await resolveLinkedLoftId(sectionType, linkedLoftIdRaw);
  if (!linkedLoftResult.ok) {
    return NextResponse.json({ ok: false, error: linkedLoftResult.error }, { status: 400 });
  }
  if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0)) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳圖片" }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  let imageFileName: string;
  try {
    imageFileName = await saveHomepageSectionImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // bio is inserted empty and only backfilled (sanitized when the row is a
  // 'featured_loft' — see resolveBio's own comment on why sanitizing happens
  // here, after placeholder resolution, rather than inside it) once the
  // row's id exists — its inline description images are stored under
  // uploads/homepage-sections/<id>/description/ (see lib/uploads.ts's
  // saveDescriptionImages), same two-phase sequencing as
  // app/api/admin/listings/route.ts (issue #315).
  const id = await createHomepageSection({
    sectionType,
    title,
    bio: null,
    linkedLoftId: linkedLoftResult.linkedLoftId,
    imageFileName,
    sortOrder,
    isActive,
  });

  try {
    const descriptionImageFileNames = await saveDescriptionImages("homepage-sections", id, descriptionImages);
    if (bioResult.bio !== null) {
      const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
        descriptionImageUrl("homepage-sections", id, fileName),
      );
      const resolvedBio = resolveDescriptionImagePlaceholders(bioResult.bio, descriptionImageUrls);
      const finalBio = sectionType === "featured_loft" ? sanitizeDescriptionHtml(resolvedBio) : resolvedBio;
      await updateHomepageSectionBio(id, finalBio);
    }
  } catch (error) {
    await deleteHomepageSection(id);
    await deleteHomepageSectionImageFile(imageFileName);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id });
}
