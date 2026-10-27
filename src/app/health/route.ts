import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql.raw("select 1"));
    return NextResponse.json({ success: true, message: "ok" });
  } catch {
    return NextResponse.json({ success: false, message: "Database tidak dapat dihubungi" }, { status: 503 });
  }
}
