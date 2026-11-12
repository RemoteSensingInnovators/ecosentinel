import { initEE } from "@/lib/server/ee";
import { decodeSpec, renderTile, tileOutside } from "@/lib/server/render";

export const runtime = "nodejs";
export const maxDuration = 60;

// 1×1 shaffof PNG
const EMPTY = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=", "base64");

export async function GET(req: Request, ctx: { params: Promise<{ spec: string; z: string; x: string; y: string }> }) {
  const p = await ctx.params;
  const spec = decodeSpec(p.spec);
  const z = Number(p.z), x = Number(p.x), y = Number(p.y.replace(/\.png$/, ""));
  if (!spec || ![z, x, y].every(Number.isInteger) || z < 4 || z > 15) return new Response("bad tile", { status: 400 });
  const immutable = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable" };
  if (tileOutside(z, x, y)) return new Response(EMPTY, { headers: immutable });
  try {
    await initEE();
    const png = await renderTile(spec, z, x, y, req.signal);
    // Joriy (tugallanmagan) yil ma'lumotlari yangilanib turadi — qisqa kesh
    const live = Math.max(spec.year, spec.base ?? 0) >= new Date().getFullYear();
    return new Response(png, { headers: live ? { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=21600" } : immutable });
  } catch (e) {
    // Brauzer so'rovni bekor qilgan (xarita surilgan) — bu xato emas
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error("[tile]", (e as Error).message);
    return new Response((e as Error).message, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
