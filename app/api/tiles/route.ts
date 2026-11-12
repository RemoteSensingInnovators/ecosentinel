import { handle, params, yearParam } from "@/lib/server/api";
import { tileUrlFor, type Mode } from "@/lib/server/render";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(async () => {
    const { q, layer, season } = params(req.url);
    const year = yearParam(q);
    const m = q.get("mode") ?? "continuous";
    const mode: Mode = m === "classes" || m === "diff" ? m : "continuous";
    const base = mode === "diff" ? yearParam(q, "base") : null;
    return tileUrlFor({ layer, season, year, mode, base });
  }, 3600);
}
