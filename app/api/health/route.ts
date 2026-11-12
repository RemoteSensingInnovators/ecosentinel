import { NextResponse } from "next/server";
import { initEE, evaluate, ee } from "@/lib/server/ee";
import { accessToken } from "@/lib/server/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const timeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

export async function GET() {
  const t = Date.now();
  const headers = { "Cache-Control": "no-store" };
  try {
    // 1) Kalit va ulanish: OAuth token + EE ishga tushirish (tez, kvotaga bog'liq emas)
    await timeout(Promise.all([initEE(), accessToken()]), 15000);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503, headers });
  }
  try {
    // 2) Hisoblash: kichik so'rov. GEE band bo'lsa — ulangan, lekin "band" deb belgilanadi
    await timeout(evaluate(ee.Number(1).add(1)), 8000);
    return NextResponse.json({ ok: true, busy: false, latencyMs: Date.now() - t }, { headers });
  } catch {
    return NextResponse.json({ ok: true, busy: true, latencyMs: Date.now() - t }, { headers });
  }
}
