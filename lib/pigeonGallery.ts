// CRUD for `pigeon_gallery_categories` and `pigeon_gallery_items` (see
// db/init.sql) — the dynamic taxonomy + display-only showcase gallery behind
// 入賞鴿展示 (award) / 進口鴿展示 (import), see GitHub issue #32/#33.
// Deliberately decoupled from lib/listings.ts: these are marketing gallery
// entries, never real transactable listings. Hand-written SQL via mysql2,
// same style as lib/listings.ts (this project has no ORM).

import { getDb } from "@/lib/db";

export type GalleryType = "award" | "import";
export type GalleryPriceType = "auction" | "fixed_price";

export type PigeonGalleryOutcome = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface PigeonGalleryCategory {
  id: number;
  galleryType: GalleryType;
  name: string;
  coverImageFileName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPigeonGalleryCategoryInput {
  galleryType: GalleryType;
  name: string;
  coverImageFileName: string;
  /** Omit to default to end-of-list (MAX(sort_order) + 1 within this galleryType). */
  sortOrder?: number;
  /** Defaults to true (visible). */
  isActive?: boolean;
}

export interface UpdatePigeonGalleryCategoryInput {
  name: string;
  coverImageFileName: string;
  sortOrder: number;
  isActive: boolean;
}

interface CategoryRow {
  id: number;
  gallery_type: GalleryType;
  name: string;
  cover_image_file_name: string;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function mapCategoryRow(row: CategoryRow): PigeonGalleryCategory {
  return {
    id: row.id,
    galleryType: row.gallery_type,
    name: row.name,
    coverImageFileName: row.cover_image_file_name,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Powers both the admin category management list (activeOnly: false) and the
// public gallery landing sections (activeOnly: true, a later ticket's
// concern) — always ordered by sort_order.
export async function listPigeonGalleryCategories(
  galleryType: GalleryType,
  options: { activeOnly?: boolean } = {},
): Promise<PigeonGalleryCategory[]> {
  const db = await getDb();
  const conditions = ["gallery_type = ?"];
  const params: (string | number)[] = [galleryType];
  if (options.activeOnly) {
    conditions.push("is_active = 1");
  }
  const [rows] = await db.query(
    `SELECT * FROM pigeon_gallery_categories WHERE ${conditions.join(" AND ")} ORDER BY sort_order ASC, id ASC`,
    params,
  );
  return (rows as CategoryRow[]).map(mapCategoryRow);
}

export async function getPigeonGalleryCategoryById(id: number): Promise<PigeonGalleryCategory | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_gallery_categories WHERE id = ? LIMIT 1", [id]);
  const row = (rows as CategoryRow[])[0];
  return row ? mapCategoryRow(row) : null;
}

export async function createPigeonGalleryCategory(input: NewPigeonGalleryCategoryInput): Promise<number> {
  const db = await getDb();

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [rows] = await db.query(
      "SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM pigeon_gallery_categories WHERE gallery_type = ?",
      [input.galleryType],
    );
    sortOrder = (rows as { nextOrder: number }[])[0].nextOrder;
  }

  const [result] = await db.query(
    `INSERT INTO pigeon_gallery_categories
       (gallery_type, name, cover_image_file_name, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [input.galleryType, input.name, input.coverImageFileName, sortOrder, input.isActive === false ? 0 : 1],
  );
  return (result as { insertId: number }).insertId;
}

export async function updatePigeonGalleryCategory(
  id: number,
  input: UpdatePigeonGalleryCategoryInput,
): Promise<PigeonGalleryOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_gallery_categories
     SET name = ?, cover_image_file_name = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [input.name, input.coverImageFileName, input.sortOrder, input.isActive ? 1 : 0, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個鴿舍分類" };
  }
  return { ok: true };
}

// There's no DB-level FK/cascade in this project (see db/init.sql's comment
// on pigeon_gallery_items), so a category's items are deleted explicitly
// first — otherwise they'd become permanently orphaned rows with a
// category_id pointing nowhere, still counted by listPigeonGalleryItems.
export async function deletePigeonGalleryCategory(id: number): Promise<PigeonGalleryOutcome> {
  const db = await getDb();
  await db.query("DELETE FROM pigeon_gallery_items WHERE category_id = ?", [id]);
  const [result] = await db.query("DELETE FROM pigeon_gallery_categories WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個鴿舍分類" };
  }
  return { ok: true };
}

// See reorderHomepageSections' comment — same bulk-resequence pattern,
// scoped to galleryType instead of sectionType.
export async function reorderPigeonGalleryCategories(
  galleryType: GalleryType,
  orderedIds: number[],
): Promise<PigeonGalleryOutcome> {
  if (orderedIds.length === 0) {
    return { ok: true };
  }

  const db = await getDb();
  const [rows] = await db.query(
    `SELECT id FROM pigeon_gallery_categories WHERE gallery_type = ? AND id IN (${orderedIds.map(() => "?").join(",")})`,
    [galleryType, ...orderedIds],
  );
  if ((rows as { id: number }[]).length !== orderedIds.length) {
    return { ok: false, error: "排序資料不正確" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.query("UPDATE pigeon_gallery_categories SET sort_order = ?, updated_at = NOW() WHERE id = ?", [
      i,
      orderedIds[i],
    ]);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface PigeonGalleryItem {
  id: number;
  categoryId: number;
  title: string;
  imageFileName: string;
  priceType: GalleryPriceType;
  referencePrice: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPigeonGalleryItemInput {
  categoryId: number;
  title: string;
  imageFileName: string;
  priceType: GalleryPriceType;
  referencePrice: number;
  /** Omit to default to end-of-list (MAX(sort_order) + 1 within this categoryId). */
  sortOrder?: number;
  /** Defaults to true (visible). */
  isActive?: boolean;
}

export interface UpdatePigeonGalleryItemInput {
  title: string;
  imageFileName: string;
  priceType: GalleryPriceType;
  referencePrice: number;
  sortOrder: number;
  isActive: boolean;
}

interface ItemRow {
  id: number;
  category_id: number;
  title: string;
  image_file_name: string;
  price_type: GalleryPriceType;
  reference_price: number;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function mapItemRow(row: ItemRow): PigeonGalleryItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    imageFileName: row.image_file_name,
    priceType: row.price_type,
    referencePrice: row.reference_price,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Powers both the admin item management list (activeOnly: false) and the
// public per-category gallery list page (activeOnly: true, plus its own
// price-type/price-range filtering — a later ticket's concern, out of scope
// here) — always ordered by sort_order.
export async function listPigeonGalleryItems(
  categoryId: number,
  options: { activeOnly?: boolean } = {},
): Promise<PigeonGalleryItem[]> {
  const db = await getDb();
  const conditions = ["category_id = ?"];
  const params: (string | number)[] = [categoryId];
  if (options.activeOnly) {
    conditions.push("is_active = 1");
  }
  const [rows] = await db.query(
    `SELECT * FROM pigeon_gallery_items WHERE ${conditions.join(" AND ")} ORDER BY sort_order ASC, id ASC`,
    params,
  );
  return (rows as ItemRow[]).map(mapItemRow);
}

export async function getPigeonGalleryItemById(id: number): Promise<PigeonGalleryItem | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_gallery_items WHERE id = ? LIMIT 1", [id]);
  const row = (rows as ItemRow[])[0];
  return row ? mapItemRow(row) : null;
}

export async function createPigeonGalleryItem(input: NewPigeonGalleryItemInput): Promise<number> {
  const db = await getDb();

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [rows] = await db.query(
      "SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM pigeon_gallery_items WHERE category_id = ?",
      [input.categoryId],
    );
    sortOrder = (rows as { nextOrder: number }[])[0].nextOrder;
  }

  const [result] = await db.query(
    `INSERT INTO pigeon_gallery_items
       (category_id, title, image_file_name, price_type, reference_price, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.categoryId,
      input.title,
      input.imageFileName,
      input.priceType,
      input.referencePrice,
      sortOrder,
      input.isActive === false ? 0 : 1,
    ],
  );
  return (result as { insertId: number }).insertId;
}

export async function updatePigeonGalleryItem(
  id: number,
  input: UpdatePigeonGalleryItemInput,
): Promise<PigeonGalleryOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_gallery_items
     SET title = ?, image_file_name = ?, price_type = ?, reference_price = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      input.title,
      input.imageFileName,
      input.priceType,
      input.referencePrice,
      input.sortOrder,
      input.isActive ? 1 : 0,
      id,
    ],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個展示鴿項目" };
  }
  return { ok: true };
}

export async function deletePigeonGalleryItem(id: number): Promise<PigeonGalleryOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM pigeon_gallery_items WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個展示鴿項目" };
  }
  return { ok: true };
}

// See reorderHomepageSections' comment — same bulk-resequence pattern,
// scoped to categoryId instead of sectionType.
export async function reorderPigeonGalleryItems(
  categoryId: number,
  orderedIds: number[],
): Promise<PigeonGalleryOutcome> {
  if (orderedIds.length === 0) {
    return { ok: true };
  }

  const db = await getDb();
  const [rows] = await db.query(
    `SELECT id FROM pigeon_gallery_items WHERE category_id = ? AND id IN (${orderedIds.map(() => "?").join(",")})`,
    [categoryId, ...orderedIds],
  );
  if ((rows as { id: number }[]).length !== orderedIds.length) {
    return { ok: false, error: "排序資料不正確" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.query("UPDATE pigeon_gallery_items SET sort_order = ?, updated_at = NOW() WHERE id = ?", [
      i,
      orderedIds[i],
    ]);
  }
  return { ok: true };
}
