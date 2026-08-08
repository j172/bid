import { getDb } from "@/lib/db";

// Persists a submission from the public /contact form (issue #104) into
// contact_messages (see db/init.sql / lib/db.ts's SCHEMA_SQL) — a plain
// history table for later admin review; no dedicated admin list page yet
// (out of scope for #104, see the issue).

export interface ContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Returns the new row's id. Throws on DB failure — the caller
// (app/api/contact/route.ts) treats that as the one hard failure case: the
// notification/confirmation emails are best-effort and must never block a
// successful response, but a message that didn't actually get stored has
// nothing to notify anyone about.
export async function insertContactMessage(input: ContactMessageInput): Promise<number> {
  const db = await getDb();
  const [result] = await db.query(
    "INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, NOW())",
    [input.name, input.email, input.subject, input.message],
  );
  return (result as { insertId: number }).insertId;
}
