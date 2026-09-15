import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { parseProductPhotoOrder, resolveProductPhotoOrder } from "@/lib/productPhotoOrder";
import {
  validateProductDescription,
  validateProductPriceText,
  validateProductSortOrder,
  validateProductTitle,
} from "@/lib/productValidation";
import { createProduct, deleteProduct, listProducts, replaceProductPhotos } from "@/lib/products";
import { deleteProductPhotoFiles, productPhotoUrl, saveProductPhotos } from "@/lib/uploads";

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
  const priceText = String(form.get("priceText") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const newPhotos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);

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
  const priceTextResult = validateProductPriceText(priceText);
  if (!priceTextResult.ok) {
    return NextResponse.json({ ok: false, error: priceTextResult.error }, { status: 400 });
  }
  const descriptionResult = validateProductDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  const sortOrderResult = validateProductSortOrder(sortOrder);
  if (!sortOrderResult.ok) {
    return NextResponse.json({ ok: false, error: sortOrderResult.error }, { status: 400 });
  }
  if (order.length === 0) {
    return NextResponse.json({ ok: false, error: "至少需要上傳一張照片" }, { status: 400 });
  }
  if (order.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }

  // The product's own id names its photo directory, so it has to exist
  // before any files are saved — same "insert first, save photos under that
  // id, then attach them" sequencing as insertListing/addListingPhotos.
  const productId = await createProduct({ title, priceText, description, sortOrder, isActive });

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
  } catch (error) {
    await deleteProduct(productId);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: productId });
}
