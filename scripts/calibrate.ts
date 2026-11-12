// Har bir qatlam va mavsum uchun 2019–2026 yillar bo'yicha yagona p2…p98 shkalasini hisoblaydi.
// Natija: lib/calibration.json. Ishga tushirish: npm run calibrate
import { writeFileSync, readFileSync } from "node:fs";
import { initEE, evaluate, ee } from "../lib/server/ee";
import { rawImage, region } from "../lib/server/composites";
import { LAYERS, SEASONS, YEARS, type LayerKey, type SeasonKey } from "../lib/layers";

const PCTS = [2, 20, 40, 60, 80, 98];
const median = (a: number[]) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function calibrate(layer: LayerKey, season: SeasonKey) {
  const scale = Math.max(LAYERS[layer].scale, 1000);
  const perYear = ee.Dictionary(
    Object.fromEntries(
      YEARS.map((y) => [
        String(y),
        rawImage(layer, y, season).reduceRegion({
          reducer: ee.Reducer.percentile(PCTS),
          geometry: region(),
          scale,
          bestEffort: true,
          maxPixels: 1e9,
          tileScale: 4,
        }),
      ]),
    ),
  );
  const r = await evaluate<Record<string, Record<string, number | null>>>(perYear);
  const out: Record<string, number> = {};
  for (const p of PCTS) out[`p${p}`] = median(Object.values(r).map((d) => d[`value_p${p}`] ?? NaN));
  return out;
}

async function main() {
  await initEE();
  let result: Record<string, Record<string, unknown>> = {};
  try {
    result = JSON.parse(readFileSync("lib/calibration.json", "utf8"));
  } catch {}
  const only = process.argv[2] as SeasonKey | "all" | undefined;
  const onlyLayers = process.argv[3]?.split(",");
  const layers = (Object.keys(LAYERS) as LayerKey[]).filter((k) => k !== "ebi" && k !== "lulc" && (!onlyLayers || onlyLayers.includes(k)));
  for (const season of Object.keys(SEASONS) as SeasonKey[]) {
    if (only && only !== "all" && season !== only) continue;
    result[season] ??= {};
    await Promise.all(
      layers.map(async (layer) => {
        const t = Date.now();
        try {
          result[season][layer] = await calibrate(layer, season);
          console.log(season, layer, JSON.stringify(result[season][layer]), `${((Date.now() - t) / 1000).toFixed(0)}s`);
        } catch (e) {
          console.error("XATO", season, layer, (e as Error).message);
        }
      }),
    );
    writeFileSync("lib/calibration.json", JSON.stringify(result, null, 2));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
