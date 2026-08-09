import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { updateProfile } from "@/lib/auth";
import { validateProfile } from "@/lib/profile";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";

  const result = validateProfile({ displayName, phone, address });
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  await updateProfile(auth.user.id, { displayName, phone, address });
  return NextResponse.json({ ok: true });
}
