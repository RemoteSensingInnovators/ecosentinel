import { handle, params, yearParam } from "@/lib/server/api";
import { districtStats } from "@/lib/server/stats";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(async () => {
    const { q, layer, season } = params(req.url);
    return districtStats(layer, yearParam(q), season);
  });
}
