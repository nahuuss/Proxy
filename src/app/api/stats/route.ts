import { NextResponse } from "next/server";
import { proxyManager } from "@/lib/proxy-manager";
import { requireAdminRouteAccess } from "@/lib/admin-route";

export async function GET() {
  const unauthorized = await requireAdminRouteAccess();
  if (unauthorized) {
    return unauthorized;
  }

  const stats = proxyManager?.getStats();
  return NextResponse.json(stats || {});
}
