import { NextResponse } from "next/server";
import { createSession, createUser, findUserByEmail } from "@/lib/auth";
import { validateProfile } from "@/lib/profile";
import { routing } from "@/i18n/routing";

// Display name is optional at registration (issue #101): a blank/whitespace
// value gets a generated placeholder before validation/insert, so the shared
// validateProfile() rule (display name required) stays satisfied without
// weakening it for other callers (e.g. account profile edits).
function generateDefaultDisplayName(): string {
  const digits = Math.floor(Math.random() * 90000 + 10000);
  return `user${digits}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rawDisplayName = typeof body?.displayName === "string" ? body.displayName : "";
  const displayName = rawDisplayName.trim() ? rawDisplayName : generateDefaultDisplayName();
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";
  const locale = routing.locales.includes(body?.locale) ? body.locale : routing.defaultLocale;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_INVALID" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, errorCode: "PASSWORD_TOO_SHORT" }, { status: 400 });
  }

  const profileResult = validateProfile({ displayName, phone, address });
  if (!profileResult.ok) {
    return NextResponse.json({ ok: false, errorCode: profileResult.errorCode }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
  }

  const user = await createUser(email, password, { displayName, phone, address }, locale);
  await createSession(user.id);

  return NextResponse.json({ ok: true, user });
}
