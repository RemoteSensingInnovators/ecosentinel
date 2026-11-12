import { handle, params, yearParam, BadRequest } from "@/lib/server/api";
import { plantGradient } from "@/lib/server/stats";
import { getPlant } from "@/lib/plants";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(async () => {
    const { q, layer, season } = params(req.url);
    const id = q.get("id");
    if (!getPlant(id)) throw new BadRequest("Noma’lum obyekt");
    return plantGradient(id!, layer, yearParam(q), season);
  });
}
