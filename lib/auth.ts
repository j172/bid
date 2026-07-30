import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

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

export async function createUser(email: string, password: string): Promise<CurrentUser> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const { hash, salt } = await hashPassword(password);
  const role = roleForEmail(normalizedEmail);

  const [result] = await db.query(
    "INSERT INTO users (email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, NOW())",
    [normalizedEmail, hash, salt, role],
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

export interface UserSummary {
  id: number;
  email: string;
  role: Role;
  createdAt: Date;
}

export async function listUsers(): Promise<UserSummary[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT id, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC",
  );
  return rows as UserSummary[];
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
     WHERE s.id = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token],
  );
  const list = rows as CurrentUser[];
  return list[0] ?? null;
}
