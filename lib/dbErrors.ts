// Small shared helper for recognizing MySQL foreign-key-constraint failures
// coming back from mysql2 as thrown errors (this project has no ORM to wrap
// them into a typed exception, see lib/db.ts's header comment). Introduced
// for issue #54's pigeon_showcase.loft_id -> homepage_sections(id) FK (see
// lib/db.ts's SCHEMA_SQL), which is the first FK constraint in this schema
// that a normal admin action (deleting a 合作鴿舍 that's still referenced)
// can actually trigger — kept here rather than inlined in
// lib/homepageSections.ts so any future FK-bearing table can reuse it too.
//
// errno 1451 (ER_ROW_IS_REFERENCED_2) fires when a DELETE/UPDATE on the
// *parent* row is blocked by a child row still pointing at it — exactly the
// RESTRICT case this schema relies on (no CASCADE / SET NULL anywhere).
export function isForeignKeyConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { errno?: number; code?: string };
  return err.errno === 1451 || err.code === "ER_ROW_IS_REFERENCED_2";
}
