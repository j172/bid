import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { parseProductPhotoOrder, resolveProductPhotoOrder } from "@/lib/productPhotoOrder";
import {
  validateProductDescription,
  validateProductPriceOrCallForPrice,
  validateProductSortOrder,
  validateProductStockQuantity,
  validateProductTitle,
} from "@/lib/productValidation";
import { createProduct, deleteProduct, listProducts, replaceProductPhotos, updateProductDescription } from "@/lib/products";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteProductPhotoFiles,
  descriptionImageUrl,
  productPhotoUrl,
  saveDescriptionImages,
  saveProductPhotos,
} from "@/lib/uploads";
import { validateYoutubeUrl } from "@/lib/youtubeEmbed";

// Admin list view (issue #277) — includes inactive (已下架) rows, same
// "admin sees everything, activeOnly is only for public-facing reads"
// convention as listHomepageSections/listHomepageVideos.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const products = await listProducts();
  return NextResponse.json({
    ok: true,
    products: products.map((product) => ({
      ...product,
      photos: product.photos.map((photo) => ({ ...photo, url: productPhotoUrl(product.id, photo.fileName) })),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  // 電洽 (call for price, issue #298 — mirrors listings' own callForPrice,
  // issue #266): the admin checks a box instead of filling in a price, and
  // price/stockQuantity validation is skipped entirely in that case;
  // createProduct then writes price=NULL/stockQuantity=NULL instead of these
  // (unused) form values.
  const callForPrice = String(form.get("callForPrice") ?? "") === "true";
  const priceRaw = Number(form.get("price"));
  const stockQuantityRaw = Number(form.get("stockQuantity"));
  const description = String(form.get("description") ?? "").trim();
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const youtubeUrlRaw = String(form.get("youtubeUrl") ?? "").trim();
  const newPhotos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  // Shape-validated up front (same reasoning as
  // app/api/admin/listings/[id]/edit/route.ts's use of parsePhotoOrder): an
  // entry with a bogus `type`/`index`/`isCover` is rejected here rather than
  // silently resolving to `undefined` later.
  const order = parseProductPhotoOrder(String(form.get("order") ?? "[]"));
  if (order === null) {
    return NextResponse.json({ ok: false, error: "照片順序資料不正確" }, { status: 400 });
  }

  const titleResult = validateProductTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const priceResult = validateProductPriceOrCallForPrice(callForPrice, priceRaw);
  if (!priceResult.ok) {
    return NextResponse.json({ ok: false, error: priceResult.error }, { status: 400 });
  }
  const stockQuantityResult = validateProductStockQuantity(stockQuantityRaw, callForPrice);
  if (!stockQuantityResult.ok) {
    return NextResponse.json({ ok: false, error: stockQuantityResult.error }, { status: 400 });
  }
  const descriptionResult = validateProductDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  const sortOrderResult = validateProductSortOrder(sortOrder);
  if (!sortOrderResult.ok) {
    return NextResponse.json({ ok: false, error: sortOrderResult.error }, { status: 400 });
  }
  const youtubeUrlResult = validateYoutubeUrl(youtubeUrlRaw);
  if (!youtubeUrlResult.ok) {
    return NextResponse.json({ ok: false, error: youtubeUrlResult.error }, { status: 400 });
  }
  const youtubeUrl = youtubeUrlRaw === "" ? null : youtubeUrlRaw;
  if (order.length === 0) {
    return NextResponse.json({ ok: false, error: "至少需要上傳一張照片" }, { status: 400 });
  }
  if (order.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  // The product's own id names its photo/description-image directories, so
  // it has to exist before any files are saved — same "insert first, save
  // photos under that id, then attach them" sequencing as
  // insertListing/addListingPhotos. description is inserted empty and only
  // backfilled (sanitized, with its `cid:N` image placeholders resolved to
  // real URLs) once that's done — same two-phase sequencing as
  // app/api/admin/listings/route.ts (issue #315 gave products its own
  // description-image upload path, mirroring listings').
  const price = callForPrice ? null : priceRaw;
  const stockQuantity = callForPrice ? null : stockQuantityRaw;

  const productId = await createProduct({
    title,
    price,
    stockQuantity,
    description: "",
    sortOrder,
    isActive,
    youtubeUrl,
  });

  try {
    const savedFileNames = await saveProductPhotos(productId, newPhotos);
    // No existing photos yet (this is a create) — every order entry must be
    // "new", cross-checked against what was actually just saved.
    const resolved = resolveProductPhotoOrder(order, [], savedFileNames);
    if (resolved === null) {
      await deleteProductPhotoFiles(productId, savedFileNames);
      await deleteProduct(productId);
      return NextResponse.json({ ok: false, error: "照片資料不正確" }, { status: 400 });
    }
    await replaceProductPhotos(productId, resolved);

    const descriptionImageFileNames = await saveDescriptionImages("products", productId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("products", productId, fileName),
    );
    const resolvedDescription = resolveDescriptionImagePlaceholders(description, descriptionImageUrls);
    await updateProductDescription(productId, sanitizeDescriptionHtml(resolvedDescription));
  } catch (error) {
    await deleteProduct(productId);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: productId });
}
