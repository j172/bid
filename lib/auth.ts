import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { findBlockingObligation } from "@/lib/listings";
import type { ErrorCode } from "@/lib/errorCodes";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type Role = "admin" | "user";

export interface CurrentUser {
  id: number;
  email: string;
  role: Role;
}

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt);
  return { hash: derivedKey.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const derivedKey = await scrypt(password, salt);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derivedKey.length) return false;
  return timingSafeEqual(stored, derivedKey);
}

function roleForEmail(email: string): Role {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  return adminEmail !== "" && email.trim().toLowerCase() === adminEmail ? "admin" : "user";
}

export async function createUser(
  email: string,
  password: string,
  profile: { displayName: string; phone: string; address: string },
  locale: string,
): Promise<CurrentUser> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const { hash, salt } = await hashPassword(password);
  const role = roleForEmail(normalizedEmail);

  const [result] = await db.query(
    `INSERT INTO users (email, password_hash, password_salt, role, display_name, phone, address, locale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      normalizedEmail,
      hash,
      salt,
      role,
      profile.displayName.trim(),
      profile.phone.trim(),
      profile.address.trim(),
      locale,
    ],
  );
  const insertId = (result as { insertId: number }).insertId;
  return { id: insertId, email: normalizedEmail, role };
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  role: Role;
  suspended_at: Date | null;
  locale: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [rows] = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
  const list = rows as UserRow[];
  return list[0] ?? null;
}

export async function createSession(userId: number): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, NOW())", [
    token,
    userId,
    expiresAt,
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.query("DELETE FROM sessions WHERE id = ?", [token]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type AccountStatus = "active" | "suspended" | "deleted";

export interface UserSummary {
  id: number;
  email: string;
  displayName: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
  bidCount: number;
  totalWon: number;
}

export interface ListUsersOptions {
  search?: string;
  role?: Role;
  /** "all" excludes deleted accounts by default — see the admin users list's default filter. */
  status?: "all" | AccountStatus;
  sort?: "created_desc" | "created_asc" | "bid_count_desc" | "gmv_desc";
  page?: number;
}

export const USERS_PAGE_SIZE = 50;

const SORT_CLAUSES: Record<NonNullable<ListUsersOptions["sort"]>, string> = {
  created_desc: "u.created_at DESC",
  created_asc: "u.created_at ASC",
  bid_count_desc: "bidCount DESC",
  gmv_desc: "totalWon DESC",
};

// Powers the admin users list: search + role/status filters + sortable
// activity aggregates (bid count, total won amount) + pagination. Bid count
// and total-won are computed via correlated subqueries (rather than a JOIN)
// to avoid fan-out duplicating rows across the many-bids-per-user relation
// — same style as getOverviewStats in lib/listings.ts.
export async function listUsers(options: ListUsersOptions = {}): Promise<{ users: UserSummary[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("(u.email LIKE ? OR u.display_name LIKE ? OR u.phone LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (options.role) {
    conditions.push("u.role = ?");
    params.push(options.role);
  }
  switch (options.status) {
    case "active":
      conditions.push("u.deleted_at IS NULL AND u.suspended_at IS NULL");
      break;
    case "suspended":
      conditions.push("u.deleted_at IS NULL AND u.suspended_at IS NOT NULL");
      break;
    case "deleted":
      conditions.push("u.deleted_at IS NOT NULL");
      break;
    case "all":
    default:
      conditions.push("u.deleted_at IS NULL");
      break;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = SORT_CLAUSES[options.sort ?? "created_desc"];
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * USERS_PAGE_SIZE;

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM users u ${whereClause}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const [rows] = await db.query(
    `SELECT
       u.id, u.email, u.display_name AS displayName, u.role, u.created_at AS createdAt,
       CASE WHEN u.deleted_at IS NOT NULL THEN 'deleted'
            WHEN u.suspended_at IS NOT NULL THEN 'suspended'
            ELSE 'active' END AS status,
       (SELECT COUNT(*) FROM bids WHERE user_id = u.id) AS bidCount,
       (SELECT COALESCE(SUM(current_price), 0) FROM listings WHERE leader_user_id = u.id AND status = 'closed') AS totalWon
     FROM users u
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ${USERS_PAGE_SIZE} OFFSET ${offset}`,
    params,
  );
  return { users: rows as UserSummary[], total };
}

export interface UserDetail {
  id: number;
  email: string;
  displayName: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
  // Needed by app/api/admin/users/[id]/reset-password/route.ts (issue #91)
  // to pick the right EMAIL_MESSAGES locale for sendPasswordResetEmail —
  // otherwise unused by app/z04urru6/users/[id]/page.tsx's own rendering.
  locale: string;
}

export async function getUserDetail(userId: number): Promise<UserDetail | null> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT
       id, email, display_name AS displayName, phone, address, role, locale, created_at AS createdAt,
       CASE WHEN deleted_at IS NOT NULL THEN 'deleted'
            WHEN suspended_at IS NOT NULL THEN 'suspended'
            ELSE 'active' END AS status
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return (rows as UserDetail[])[0] ?? null;
}

export type RoleChangeOutcome = { ok: true } | { ok: false; error: string };

// Promoting to admin has no restrictions; demoting to a plain user is
// blocked in two cases: acting on your own account (so an admin can never
// lock themselves out by mistake) and demoting the last remaining
// operational admin (deleted/suspended admins don't count — they can't log
// in anyway, so they're not "operational" for this purpose).
export async function setUserRole(targetUserId: number, newRole: Role, actingUserId: number): Promise<RoleChangeOutcome> {
  const db = await getDb();

  if (newRole === "user") {
    if (targetUserId === actingUserId) {
      return { ok: false, error: "不能將自己降級" };
    }
    const [rows] = await db.query("SELECT role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1", [
      targetUserId,
    ]);
    const target = (rows as { role: Role }[])[0];
    if (!target) {
      return { ok: false, error: "找不到這個使用者" };
    }
    if (target.role === "admin") {
      const [countRows] = await db.query(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND deleted_at IS NULL AND suspended_at IS NULL",
      );
      if ((countRows as { cnt: number }[])[0].cnt <= 1) {
        return { ok: false, error: "無法降級：這是系統中唯一的管理員" };
      }
    }
  }

  const [result] = await db.query("UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL", [
    newRole,
    targetUserId,
  ]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個使用者" };
  }
  return { ok: true };
}

export type SuspendOutcome = { ok: true } | { ok: false; error: string };

// Suspension blocks login (see findUserByEmail's caller in the login route,
// and getCurrentUser's suspended_at check) but never blocks on a leading
// bid/listing — unlike deleteAccount, it's meant as an instantly-reversible
// administrative kill switch, not a permanent removal. The same self- and
// last-admin protections as setUserRole apply, since suspending an admin is
// operationally equivalent to demoting them (they can't use the backend
// either way).
export async function suspendUser(targetUserId: number, actingUserId: number): Promise<SuspendOutcome> {
  if (targetUserId === actingUserId) {
    return { ok: false, error: "不能停權自己" };
  }
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT role, suspended_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [targetUserId],
  );
  const target = (rows as { role: Role; suspended_at: Date | null }[])[0];
  if (!target) {
    return { ok: false, error: "找不到這個使用者" };
  }
  if (target.role === "admin" && target.suspended_at === null) {
    const [countRows] = await db.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND deleted_at IS NULL AND suspended_at IS NULL",
    );
    if ((countRows as { cnt: number }[])[0].cnt <= 1) {
      return { ok: false, error: "無法停權：這是系統中唯一的管理員" };
    }
  }

  await db.query("UPDATE users SET suspended_at = NOW() WHERE id = ?", [targetUserId]);
  await db.query("DELETE FROM sessions WHERE user_id = ?", [targetUserId]);
  return { ok: true };
}

export async function unsuspendUser(targetUserId: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE users SET suspended_at = NULL WHERE id = ?", [targetUserId]);
}

export interface AccountProfile {
  email: string;
  displayName: string;
  phone: string;
  address: string;
}

export async function getAccountProfile(userId: number): Promise<AccountProfile | null> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT email, display_name AS displayName, phone, address FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const list = rows as AccountProfile[];
  return list[0] ?? null;
}

export async function updateProfile(
  userId: number,
  profile: { displayName: string; phone: string; address: string },
): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE users SET display_name = ?, phone = ?, address = ? WHERE id = ?", [
    profile.displayName.trim(),
    profile.phone.trim(),
    profile.address.trim(),
    userId,
  ]);
}

export type ChangePasswordOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

// Same "kick every other session" treatment as suspendUser/deleteAccount and
// the forgot-password flow's resetPassword (lib/passwordReset.ts) — a
// changed password should invalidate any session an attacker (or a stale
// device) might still be holding. Unlike those two, this one is triggered by
// the logged-in owner themselves from an active session, so it deliberately
// keeps *that* session alive (read from the request's own cookie) rather
// than logging the caller out of the request they just made.
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<ChangePasswordOutcome> {
  const db = await getDb();
  const [rows] = await db.query("SELECT password_hash, password_salt FROM users WHERE id = ? LIMIT 1", [userId]);
  const row = (rows as { password_hash: string; password_salt: string }[])[0];
  if (!row || !(await verifyPassword(oldPassword, row.password_hash, row.password_salt))) {
    return { ok: false, errorCode: "WRONG_OLD_PASSWORD" };
  }
  if (newPassword.length < 8) {
    return { ok: false, errorCode: "NEW_PASSWORD_TOO_SHORT" };
  }

  const { hash, salt } = await hashPassword(newPassword);
  await db.query("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", [hash, salt, userId]);

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (currentToken) {
    await db.query("DELETE FROM sessions WHERE user_id = ? AND id != ?", [userId, currentToken]);
  } else {
    await db.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
  }

  return { ok: true };
}

export type DeleteAccountOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

// Anonymizes rather than hard-deletes: bids/listings still reference this
// user_id (no FK cascade), and past auction records (who won what) need to
// stay intact for history/audit — see listClosedListings' deleted-account
// display handling. The email is overwritten (not just flagged) so the
// original address frees up for re-registration.
export async function deleteAccount(userId: number): Promise<DeleteAccountOutcome> {
  const blockingReason = await findBlockingObligation(userId);
  if (blockingReason) {
    return { ok: false, errorCode: blockingReason };
  }

  const db = await getDb();
  const unusablePassword = randomBytes(32).toString("hex");
  await db.query(
    `UPDATE users
     SET email = CONCAT('deleted-', id, '@deleted.invalid'),
         password_hash = ?, password_salt = ?,
         display_name = NULL, phone = NULL, address = NULL,
         deleted_at = NOW()
     WHERE id = ?`,
    [unusablePassword, unusablePassword, userId],
  );
  await db.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
  return { ok: true };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > NOW() AND u.suspended_at IS NULL
     LIMIT 1`,
    [token],
  );
  const list = rows as CurrentUser[];
  return list[0] ?? null;
}
