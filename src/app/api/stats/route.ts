import { NextResponse } from "next/server";
import { proxyManager } from "@/lib/proxy-manager";

export async function GET() {
  const stats = proxyManager?.getStats();
  return NextResponse.json(stats || {});
}
