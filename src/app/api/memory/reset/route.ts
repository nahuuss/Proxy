import { NextResponse } from "next/server";
import { forceMemoryReset } from "@/lib/db";
import { requireAdminRouteAccess } from "@/lib/admin-route";

export async function POST() {
  const unauthorized = await requireAdminRouteAccess();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    await forceMemoryReset();
    return NextResponse.json({ success: true, lastMemoryReset: Date.now() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
