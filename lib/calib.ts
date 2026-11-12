import calibration from "./calibration.json";
import { LAYERS, type LayerKey, type SeasonKey } from "./layers";

export type Calib = { p2: number; p20: number; p40: number; p60: number; p80: number; p98: number };
const CAL = calibration as unknown as Partial<Record<SeasonKey, Partial<Record<LayerKey, Calib>>>>;

/** Xom GEE birligidagi kalibrovka (2019–2026 yillar mediani) */
export function getCalib(layer: LayerKey, season: SeasonKey): Calib | null {
  if (layer === "ebi") return { p2: 0, p20: 20, p40: 40, p60: 60, p80: 80, p98: 100 };
  // Suv viloyat maydonining <1% ini egallaydi — kvantillar suvni ajratmaydi, fizik chegaralar olinadi
  if (layer === "mndwi") return { p2: -0.5, p20: -0.4, p40: -0.3, p60: 0, p80: 0.2, p98: 0.6 };
  return CAL[season]?.[layer] ?? CAL.summer?.[layer] ?? null;
}

/** Ko'rsatish birligidagi kalibrovka */
export function displayCalib(layer: LayerKey, season: SeasonKey): Calib | null {
  const c = getCalib(layer, season);
  if (!c) return null;
  const f = layer === "ebi" ? 1 : LAYERS[layer].factor;
  return { p2: c.p2 * f, p20: c.p20 * f, p40: c.p40 * f, p60: c.p60 * f, p80: c.p80 * f, p98: c.p98 * f };
}

export function classIndex(v: number, c: Calib): number {
  return (v > c.p20 ? 1 : 0) + (v > c.p40 ? 1 : 0) + (v > c.p60 ? 1 : 0) + (v > c.p80 ? 1 : 0);
}
