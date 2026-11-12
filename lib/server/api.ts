import { NextResponse } from "next/server";
import { initEE } from "./ee";
import { isLayer, isSeason, isYear, type LayerKey, type SeasonKey } from "../layers";

export class BadRequest extends Error {}

export function params(url: string) {
  const q = new URL(url).searchParams;
  const layer = q.get("layer");
  const season = q.get("season") ?? "summer";
  if (!isLayer(layer)) throw new BadRequest("Noto‘g‘ri qatlam");
  if (!isSeason(season)) throw new BadRequest("Noto‘g‘ri mavsum");
  return { q, layer: layer as LayerKey, season: season as SeasonKey };
}

export function yearParam(q: URLSearchParams, name = "year") {
  const y = Number(q.get(name));
  if (!isYear(y)) throw new BadRequest(`Noto‘g‘ri yil: ${q.get(name)}`);
  return y;
}

export async function handle(fn: () => Promise<unknown>, cacheSeconds = 21600) {
  try {
    await initEE();
    const data = await fn();
    return NextResponse.json(data, {
      headers: { "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 4}` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = e instanceof BadRequest ? 400 : 502;
    console.error("[api]", msg);
    return NextResponse.json({ error: msg }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
