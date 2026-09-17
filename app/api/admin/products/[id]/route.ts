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
  validateProductStockRemaining,
  validateProductTitle,
} from "@/lib/productValidation";
import { deleteProduct, getProductById, replaceProductPhotos, updateProduct } from "@/lib/products";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteProductPhotoFiles,
  descriptionImageUrl,
  productPhotoUrl,
  saveDescriptionImages,
  saveProductPhotos,
} from "@/lib/uploads";
import { validateYoutubeUrl } from "@/lib/youtubeEmbed";
import { parseIdParam } from "@/lib/routeParams";

// Powers the admin edit modal's prefill (ProductFormModal.tsx) — always
// fetched without activeOnly so an admin can open and re-publish a
// currently-下架 product, unlike the public detail page's read.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const productId = parseIdParam(id);
  if (productId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const product = await getProductById(productId);
  if (!product) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    product: {
      ...product,
      photos: product.photos.map((photo) => ({ ...photo, url: productPhotoUrl(product.id, photo.fileName) })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const productId = parseIdParam(id);
  if (productId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const existing = await getProductById(productId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const callForPrice = String(form.get("callForPrice") ?? "") === "true";
  const priceRaw = Number(form.get("price"));
  const stockRemainingRaw = Number(form.get("stockRemaining"));
  const description = String(form.get("description") ?? "").trim();
  const sortOrder = Number(form.get("sortOrder"));
  const isActiveRaw = String(form.get("isActive") ?? "true");
  const isActive = isActiveRaw === "true" || isActiveRaw === "1";
  const youtubeUrlRaw = String(form.get("youtubeUrl") ?? "").trim();
  const newPhotos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

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
  const stockRemainingResult = validateProductStockRemaining(stockRemainingRaw, callForPrice);
  if (!stockRemainingResult.ok) {
    return NextResponse.json({ ok: false, error: stockRemainingResult.error }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "至少需要一張照片" }, { status: 400 });
  }
  if (order.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  const currentFileNames = existing.photos.map((photo) => photo.fileName);

  let savedFileNames: string[];
  let finalDescription: string;
  try {
    savedFileNames = await saveProductPhotos(productId, newPhotos);
    const descriptionImageFileNames = await saveDescriptionImages("products", productId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("products", productId, fileName),
    );
    finalDescription = sanitizeDescriptionHtml(resolveDescriptionImagePlaceholders(description, descriptionImageUrls));
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Cross-checks the order against reality: every "existing" entry must
  // still be one of this product's current photos, and every "new" entry
  // must point at a file this request actually saved — same guard as the
  // listing edit route's resolvePhotoOrder.
  const resolved = resolveProductPhotoOrder(order, currentFileNames, savedFileNames);
  if (resolved === null) {
    await deleteProductPhotoFiles(productId, savedFileNames);
    return NextResponse.json({ ok: false, error: "照片資料不正確" }, { status: 400 });
  }

  const price = callForPrice ? null : priceRaw;
  const stockRemaining = callForPrice ? null : stockRemainingRaw;

  const result = await updateProduct(productId, {
    title,
    price,
    stockRemaining,
    description: finalDescription,
    sortOrder,
    isActive,
    youtubeUrl,
  });
  if (!result.ok) {
    // Roll back the newly-saved files — the update was rejected (e.g. the
    // product was deleted by someone else between the check above and now).
    await deleteProductPhotoFiles(productId, savedFileNames);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await replaceProductPhotos(productId, resolved);

  const keptFileNames = new Set(resolved.map((photo) => photo.fileName));
  const removedFileNames = currentFileNames.filter((fileName) => !keptFileNames.has(fileName));
  await deleteProductPhotoFiles(productId, removedFileNames);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const productId = parseIdParam(id);
  if (productId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const existing = await getProductById(productId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const result = await deleteProduct(productId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  await deleteProductPhotoFiles(
    productId,
    existing.photos.map((photo) => photo.fileName),
  );
  return NextResponse.json({ ok: true });
}
