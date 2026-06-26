import { NextResponse } from "next/server";
import { forceMemoryReset } from "@/lib/db";

export async function POST() {
  try {
    await forceMemoryReset();
    return NextResponse.json({ success: true, lastMemoryReset: Date.now() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
