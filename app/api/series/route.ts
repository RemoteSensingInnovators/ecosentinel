import { handle, params } from "@/lib/server/api";
import { regionSeries } from "@/lib/server/stats";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(async () => {
    const { q, layer, season } = params(req.url);
    return regionSeries(layer, season, q.get("district") ?? undefined, q.get("plant") ?? undefined);
  });
}
