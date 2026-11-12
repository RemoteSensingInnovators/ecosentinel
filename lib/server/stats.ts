import { ee, evaluate, cached } from "./ee";
import { displayImage, rawImage, districts, region } from "./composites";
import { LAYERS, YEARS, DISTRICT_NAMES, LULC_CLASSES, type LayerKey, type SeasonKey } from "../layers";
import { GRADIENT_RINGS, getPlant } from "../plants";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TTL = 12 * 3600 * 1000;

export type Shares = number[]; // LULC sinf ulushlari, %

function sharesFromHist(h: Record<string, number> | null | undefined): Shares {
  const out = LULC_CLASSES.map(() => 0);
  if (!h) return out;
  const total = Object.values(h).reduce((a, b) => a + b, 0) || 1;
  for (const [k, v] of Object.entries(h)) {
    const i = Math.round(Number(k));
    if (i >= 0 && i < out.length) out[i] = +((100 * v) / total).toFixed(2);
  }
  return out;
}

function reducerFor(layer: LayerKey) {
  return LAYERS[layer].categorical
    ? ee.Reducer.frequencyHistogram()
    : ee.Reducer.mean().combine({ reducer2: ee.Reducer.percentile([10, 90]), sharedInputs: true });
}

function imageFor(layer: LayerKey, year: number, season: SeasonKey) {
  return LAYERS[layer].categorical ? rawImage(layer, year, season) : displayImage(layer, year, season);
}

/**
 * Statistika masshtabi (m). Og'ir kompozitlar — Sentinel-5P mediana (~5.5 km haqiqiy piksel), CHIRPS
 * va EBI — yiriklashtirilgan masshtabda hisoblanadi, aks holda Vercel'ning 60 s limitidan oshadi.
 */
function statScale(layer: LayerKey, kind: "district" | "series") {
  const s = LAYERS[layer].scale;
  if (s >= 1000) return Math.max(s, kind === "series" ? 3000 : 2000);
  return kind === "series" ? Math.max(s, 500) : s;
}

export interface DistrictStat { id: string; name: string; mean: number | null; p10?: number | null; p90?: number | null; shares?: Shares }

export function districtStats(layer: LayerKey, year: number, season: SeasonKey) {
  return cached(`d:${layer}:${year}:${season}`, TTL, async () => {
    const img = imageFor(layer, year, season);
    const scale = statScale(layer, "district");
    const fc = img.reduceRegions({ collection: districts(), reducer: reducerFor(layer), scale, tileScale: 8 })
      .map((f: any) => ee.Feature(null, f.toDictionary().set("id", f.get("ADM2_NAME"))));
    const all = img.reduceRegion({ reducer: reducerFor(layer), geometry: region(), scale: statScale(layer, "series"), bestEffort: true, maxPixels: 1e9, tileScale: 8 });
    const [rows, reg] = await Promise.all([
      evaluate<{ features: { properties: Record<string, any> }[] }>(fc),
      evaluate<Record<string, any>>(all),
    ]);
    const categorical = LAYERS[layer].categorical;
    const list: DistrictStat[] = rows.features.map(({ properties: p }) => ({
      id: p.id,
      name: DISTRICT_NAMES[p.id] ?? p.id,
      mean: categorical ? null : p.mean ?? null,
      p10: p.p10 ?? null,
      p90: p.p90 ?? null,
      shares: categorical ? sharesFromHist(p.histogram) : undefined,
    }));
    return {
      layer, year, season,
      region: categorical
        ? { mean: null, shares: sharesFromHist(reg.value) }
        : { mean: reg.value_mean ?? null, p10: reg.value_p10 ?? null, p90: reg.value_p90 ?? null },
      districts: list,
    };
  });
}

export interface SeriesPoint { year: number; mean: number | null; shares?: Shares }

function seriesOver(layer: LayerKey, season: SeasonKey, geom: any, key: string) {
  return cached(`s:${layer}:${season}:${key}`, TTL, async () => {
    const scale = statScale(layer, "series");
    const red = LAYERS[layer].categorical ? ee.Reducer.frequencyHistogram() : ee.Reducer.mean();
    const dict = ee.Dictionary(
      Object.fromEntries(
        YEARS.map((y) => [
          String(y),
          imageFor(layer, y, season).reduceRegion({ reducer: red, geometry: geom, scale, bestEffort: true, maxPixels: 1e9, tileScale: 8 }).get("value"),
        ]),
      ),
    );
    const r = await evaluate<Record<string, any>>(dict);
    return YEARS.map<SeriesPoint>((y) =>
      LAYERS[layer].categorical
        ? { year: y, mean: null, shares: sharesFromHist(r[String(y)]) }
        : { year: y, mean: typeof r[String(y)] === "number" ? r[String(y)] : null },
    );
  });
}

export function regionSeries(layer: LayerKey, season: SeasonKey, district?: string, plantId?: string) {
  if (plantId) {
    const p = getPlant(plantId);
    if (!p) throw new Error("Noma’lum obyekt");
    const r = Math.max(...p.zones.map((z) => z.radius_m));
    return seriesOver(layer, season, ee.Geometry.Point([p.lon, p.lat]).buffer(r, 100), `plant:${p.id}`);
  }
  if (district) {
    if (!(district in DISTRICT_NAMES)) throw new Error("Noma’lum tuman");
    const geom = districts().filter(ee.Filter.eq("ADM2_NAME", district)).geometry();
    return seriesOver(layer, season, geom, district);
  }
  return seriesOver(layer, season, region(), "region");
}



export interface RingStat { from: number; to: number; mean: number | null }

/** Zavoddan masofa bo'yicha halqalardagi o'rtacha qiymat — ta'sir gradienti */
export function plantGradient(plantId: string, layer: LayerKey, year: number, season: SeasonKey) {
  const p = getPlant(plantId);
  if (!p) throw new Error("Noma’lum obyekt");
  if (LAYERS[layer].categorical) throw new Error("Yer qoplami sinflari uchun gradient hisoblanmaydi");
  return cached(`g:${p.id}:${layer}:${year}:${season}`, TTL, async () => {
    const c = ee.Geometry.Point([p.lon, p.lat]);
    const rings = GRADIENT_RINGS.slice(1).map((to, i) => {
      const from = GRADIENT_RINGS[i];
      const outer = c.buffer(to, 50);
      const geom = from === 0 ? outer : outer.difference(c.buffer(from, 50), 50);
      return ee.Feature(geom, { from, to });
    });
    // Sentinel-5P piksellari (~5.5 km) kichik halqalardan katta — mos masshtab olinadi
    const scale = Math.min(LAYERS[layer].scale, 1000);
    const fc = displayImage(layer, year, season).reduceRegions({ collection: ee.FeatureCollection(rings), reducer: ee.Reducer.mean(), scale, tileScale: 4 })
      .map((f: any) => ee.Feature(null, f.toDictionary()));
    const r = await evaluate<{ features: { properties: { from: number; to: number; mean?: number } }[] }>(fc);
    return r.features.map<RingStat>(({ properties: q }) => ({ from: q.from, to: q.to, mean: typeof q.mean === "number" ? q.mean : null }));
  });
}
