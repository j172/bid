// CRUD for `products` / `product_photos` (see db/init.sql) — the standalone
// admin-managed商品 CMS that powers the homepage carousel added by issue #278
// and this ticket's own public /products/[id] detail page (issue #277).
// Hand-written SQL via mysql2, same style as lib/homepageSections.ts / this
// project has no ORM. Deliberately its own table rather than reusing
// homepage_sections or binding to listings — see db/init.sql's header
// comment on the products table for the full reasoning.

import { getDb } from "@/lib/db";
import type { ResolvedProductPhoto } from "@/lib/productPhotoOrder";

export interface ProductPhoto {
  id: number;
  fileName: string;
  sortOrder: number;
  isCover: boolean;
}

export interface Product {
  id: number;
  title: string;
  /** Free display text (e.g. "NT$12,000") — never parsed as a number. */
  priceText: string;
  /** Rich text (TinyMCE HTML), sanitized via lib/sanitizeDescriptionHtml.ts before storage — see lib/productValidation.ts. Issue #286: previously plain text; existing plain-text rows remain valid, untagged HTML. */
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Optional featured YouTube video link (issue #286) — rendered on the public product detail page when set. */
  youtubeUrl: string | null;
}

export interface ProductWithPhotos extends Product {
  /** Ordered by sort_order ASC, id ASC — same convention as listing_photos. */
  photos: ProductPhoto[];
}

export interface NewProductInput {
  title: string;
  priceText: string;
  description: string;
  /** Omit to default to end-of-list (MAX(sort_order) + 1) — see createProduct. */
  sortOrder?: number;
  /** Defaults to true (visible). */
  isActive?: boolean;
  /** Optional featured YouTube video (issue #286) — null/omit for none. */
  youtubeUrl?: string | null;
}

export interface UpdateProductInput {
  title: string;
  priceText: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  /** Full replace, like every other field here — null clears it. */
  youtubeUrl: string | null;
}

export type ProductOutcome = { ok: true } | { ok: false; error: string };

interface ProductRow {
  id: number;
  title: string;
  price_text: string;
  description: string;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
  youtube_url: string | null;
}

interface ProductPhotoRow {
  id: number;
  product_id: number;
  file_name: string;
  sort_order: number;
  is_cover: number;
  created_at: Date;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    priceText: row.price_text,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    youtubeUrl: row.youtube_url,
  };
}

function mapPhotoRow(row: ProductPhotoRow): ProductPhoto {
  return {
    id: row.id,
    fileName: row.file_name,
    sortOrder: row.sort_order,
    isCover: Boolean(row.is_cover),
  };
}

// Ordered by sort_order ASC, id ASC — same tie-break convention as
// listing_photos/homepage_sections' own listing queries.
export async function getProductPhotos(productId: number): Promise<ProductPhoto[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT * FROM product_photos WHERE product_id = ? ORDER BY sort_order ASC, id ASC",
    [productId],
  );
  return (rows as ProductPhotoRow[]).map(mapPhotoRow);
}

// Powers both the admin management list (activeOnly: false — admins still
// need to see disabled rows to be able to re-enable them) and the homepage
// carousel (activeOnly: true, issue #278's concern). Fetches each row's
// photos with a separate per-row query (same N+1-but-small-dataset shape as
// lib/listings.ts's listOpenListings/getPhotoFileNames) rather than a JOIN —
// this project has no ORM and the admin/homepage product counts are small.
export async function listProducts(options: { activeOnly?: boolean } = {}): Promise<ProductWithPhotos[]> {
  const db = await getDb();
  const where = options.activeOnly ? "WHERE is_active = 1" : "";
  const [rows] = await db.query(`SELECT * FROM products ${where} ORDER BY sort_order ASC, id ASC`);
  const products = (rows as ProductRow[]).map(mapProductRow);

  const withPhotos: ProductWithPhotos[] = [];
  for (const product of products) {
    withPhotos.push({ ...product, photos: await getProductPhotos(product.id) });
  }
  return withPhotos;
}

// options.activeOnly gates whether an inactive (下架) row is even visible to
// the caller — the public product detail page passes activeOnly: true so an
// unpublished product 404s for a public visitor even if they have the direct
// URL; the admin edit form passes it false (the default) so admins can still
// open and re-publish a disabled row.
export async function getProductById(
  id: number,
  options: { activeOnly?: boolean } = {},
): Promise<ProductWithPhotos | null> {
  const db = await getDb();
  const conditions = ["id = ?"];
  const params: number[] = [id];
  if (options.activeOnly) conditions.push("is_active = 1");

  const [rows] = await db.query(`SELECT * FROM products WHERE ${conditions.join(" AND ")} LIMIT 1`, params);
  const row = (rows as ProductRow[])[0];
  if (!row) return null;

  const product = mapProductRow(row);
  return { ...product, photos: await getProductPhotos(product.id) };
}

// New rows default to the end of the current ordering unless the caller
// passes an explicit sortOrder — same "blank sort order input means append"
// behavior as createHomepageSection/createHomepageVideo.
export async function createProduct(input: NewProductInput): Promise<number> {
  const db = await getDb();

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [rows] = await db.query("SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM products");
    sortOrder = (rows as { nextOrder: number }[])[0].nextOrder;
  }

  const [result] = await db.query(
    `INSERT INTO products (title, price_text, description, sort_order, is_active, created_at, updated_at, youtube_url)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
    [input.title, input.priceText, input.description, sortOrder, input.isActive === false ? 0 : 1, input.youtubeUrl ?? null],
  );
  return (result as { insertId: number }).insertId;
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<ProductOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE products SET title = ?, price_text = ?, description = ?, sort_order = ?, is_active = ?, youtube_url = ?, updated_at = NOW()
     WHERE id = ?`,
    [input.title, input.priceText, input.description, input.sortOrder, input.isActive ? 1 : 0, input.youtubeUrl, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個商品" };
  }
  return { ok: true };
}

// No DB-level FK from product_photos to products (same as listing_photos →
// listings), so the photo rows are deleted explicitly first, same "delete
// children, then the parent" order as lib/listings.ts's deleteListing. Only
// removes DB rows — deleting the photo files themselves on disk is the
// caller's job (see app/api/admin/products/[id]/route.ts's DELETE handler),
// same split of responsibility as the homepage-sections delete route.
export async function deleteProduct(id: number): Promise<ProductOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM products WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個商品" };
  }
  await db.query("DELETE FROM product_photos WHERE product_id = ?", [id]);
  return { ok: true };
}

// Used by both the create and edit routes: the caller sends the complete
// desired final order (a mix of kept-existing and newly-uploaded photos, each
// with its own isCover flag already resolved — see
// lib/productPhotoOrder.ts's resolveProductPhotoOrder) rather than an
// incremental diff, so this just replaces the whole set — same
// simpler-than-diffing shape as lib/listings.ts's replaceListingPhotos.
export async function replaceProductPhotos(productId: number, photos: ResolvedProductPhoto[]): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM product_photos WHERE product_id = ?", [productId]);
  for (let i = 0; i < photos.length; i++) {
    await db.query(
      "INSERT INTO product_photos (product_id, file_name, sort_order, is_cover, created_at) VALUES (?, ?, ?, ?, NOW())",
      [productId, photos[i].fileName, i, photos[i].isCover ? 1 : 0],
    );
  }
}
