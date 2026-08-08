import { NextResponse } from "next/server";
import { validateContact } from "@/lib/contactValidation";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { insertContactMessage } from "@/lib/contact";
import { sendContactMessageEmails } from "@/lib/notifications";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { routing } from "@/i18n/routing";

// Public /contact form submit (issue #104) — no login required. Order of
// operations matters: validate fields -> verify Turnstile -> insert into
// contact_messages -> best-effort emails. A DB insert failure is returned
// as an error (nothing was actually recorded); an email failure after a
// successful insert is only logged, never surfaced to the caller — see
// lib/notifications.ts's sendContactMessageEmails.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const message = typeof body?.message === "string" ? body.message : "";
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
  const locale = routing.locales.includes(body?.locale) ? body.locale : routing.defaultLocale;

  const validation = validateContact({ name, email, subject, message });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errorCode: validation.errorCode }, { status: 400 });
  }

  const ip = getClientIpFromHeaders(request.headers);
  const verified = await verifyTurnstileToken(turnstileToken, ip);
  if (!verified) {
    return NextResponse.json({ ok: false, errorCode: "TURNSTILE_VERIFICATION_FAILED" }, { status: 400 });
  }

  const details = {
    name: name.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
  };

  try {
    await insertContactMessage(details);
  } catch (error) {
    console.error("Failed to insert contact message:", error);
    return NextResponse.json({ ok: false, errorCode: "CONTACT_SUBMIT_FAILED" }, { status: 500 });
  }

  // Best-effort — the message is already safely stored, so a failed email
  // here must not turn this into an error response (see sendContactMessageEmails).
  await sendContactMessageEmails(details, locale);

  return NextResponse.json({ ok: true });
}
