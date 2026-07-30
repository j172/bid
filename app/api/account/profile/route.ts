import { NextResponse } from "next/server";
import { getCurrentUser, updateProfile } from "@/lib/auth";
import { validateProfile } from "@/lib/profile";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";

  const result = validateProfile({ displayName, phone, address });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await updateProfile(user.id, { displayName, phone, address });
  return NextResponse.json({ ok: true });
}
