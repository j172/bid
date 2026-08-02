// CRUD for `homepage_sections` (see db/init.sql) — generic image+link+
// sort_order homepage CMS blocks. Currently only section_type='partner_loft'
// (合作鴿舍, see GitHub issue #32/#33) exists, but the table/API stay generic
// so a future block can reuse the same machinery without a new table.
// Hand-written SQL via mysql2, same style as lib/listings.ts (this project
// has no ORM).

import { getDb } from "@/lib/db";

export interface HomepageSection {
  id: number;
  sectionType: string;
  title: string;
  imageFileName: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewHomepageSectionInput {
  sectionType: string;
  title: string;
  imageFileName: string;
  linkUrl: string;
  /** Omit to default to end-of-list (MAX(sort_order) + 1 within this sectionType) — see createHomepageSection. */
  sortOrder?: number;
  /** Defaults to true (visible). */
  isActive?: boolean;
}

export interface UpdateHomepageSectionInput {
  title: string;
  imageFileName: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export type HomepageSectionOutcome = { ok: true } | { ok: false; error: string };

interface HomepageSectionRow {
  id: number;
  section_type: string;
  title: string;
  image_file_name: string;
  link_url: string;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: HomepageSectionRow): HomepageSection {
  return {
    id: row.id,
    sectionType: row.section_type,
    title: row.title,
    imageFileName: row.image_file_name,
    linkUrl: row.link_url,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Powers both the admin management list (activeOnly: false — admins still
// need to see disabled rows to be able to re-enable them) and the public
// homepage block (activeOnly: true, a later ticket's concern). Always
// ordered by sort_order so callers never need to re-sort client-side; id ASC
// breaks ties deterministically for freshly-created rows sharing a sort_order.
export async function listHomepageSections(
  sectionType: string,
  options: { activeOnly?: boolean } = {},
): Promise<HomepageSection[]> {
  const db = await getDb();
  const conditions = ["section_type = ?"];
  const params: (string | number)[] = [sectionType];
  if (options.activeOnly) {
    conditions.push("is_active = 1");
  }
  const [rows] = await db.query(
    `SELECT * FROM homepage_sections WHERE ${conditions.join(" AND ")} ORDER BY sort_order ASC, id ASC`,
    params,
  );
  return (rows as HomepageSectionRow[]).map(mapRow);
}

export async function getHomepageSectionById(id: number): Promise<HomepageSection | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM homepage_sections WHERE id = ? LIMIT 1", [id]);
  const row = (rows as HomepageSectionRow[])[0];
  return row ? mapRow(row) : null;
}

// New rows default to the end of their section_type's current ordering
// unless the caller passes an explicit sortOrder — keeps a freshly created
// row from jumping ahead of existing ones when the admin form's sort_order
// input is left blank.
export async function createHomepageSection(input: NewHomepageSectionInput): Promise<number> {
  const db = await getDb();

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [rows] = await db.query(
      "SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM homepage_sections WHERE section_type = ?",
      [input.sectionType],
    );
    sortOrder = (rows as { nextOrder: number }[])[0].nextOrder;
  }

  const [result] = await db.query(
    `INSERT INTO homepage_sections
       (section_type, title, image_file_name, link_url, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.sectionType,
      input.title,
      input.imageFileName,
      input.linkUrl,
      sortOrder,
      input.isActive === false ? 0 : 1,
    ],
  );
  return (result as { insertId: number }).insertId;
}

export async function updateHomepageSection(
  id: number,
  input: UpdateHomepageSectionInput,
): Promise<HomepageSectionOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE homepage_sections
     SET title = ?, image_file_name = ?, link_url = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [input.title, input.imageFileName, input.linkUrl, input.sortOrder, input.isActive ? 1 : 0, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個首頁區塊項目" };
  }
  return { ok: true };
}

export async function deleteHomepageSection(id: number): Promise<HomepageSectionOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM homepage_sections WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個首頁區塊項目" };
  }
  return { ok: true };
}

// Bulk re-sequences every row named in orderedIds to sort_order = its index
// in that array. There's no drag-and-drop UI (out of scope for this ticket —
// sort_order is just a number input per row), but the admin list still needs
// a way to apply a whole new ordering atomically once it collects the
// desired sequence, rather than requiring one PATCH per row. Scoped to
// sectionType and rejected as a whole (no partial writes) if any id doesn't
// belong to it, e.g. a stale client sending an id from a different section.
export async function reorderHomepageSections(
  sectionType: string,
  orderedIds: number[],
): Promise<HomepageSectionOutcome> {
  if (orderedIds.length === 0) {
    return { ok: true };
  }

  const db = await getDb();
  const [rows] = await db.query(
    `SELECT id FROM homepage_sections WHERE section_type = ? AND id IN (${orderedIds.map(() => "?").join(",")})`,
    [sectionType, ...orderedIds],
  );
  if ((rows as { id: number }[]).length !== orderedIds.length) {
    return { ok: false, error: "排序資料不正確" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db.query("UPDATE homepage_sections SET sort_order = ?, updated_at = NOW() WHERE id = ?", [i, orderedIds[i]]);
  }
  return { ok: true };
}
