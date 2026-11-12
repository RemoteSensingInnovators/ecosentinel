// Umumiy (client + server) qatlam konfiguratsiyasi.

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
export type Year = (typeof YEARS)[number];

export type SeasonKey = "summer" | "spring" | "autumn" | "annual";
export const SEASONS: Record<SeasonKey, { label: string; start: string; end: string; range: string }> = {
  spring: { label: "Bahor", start: "03-01", end: "06-01", range: "01.03 — 31.05" },
  summer: { label: "Yoz", start: "06-01", end: "09-01", range: "01.06 — 31.08" },
  autumn: { label: "Kuz", start: "09-01", end: "12-01", range: "01.09 — 30.11" },
  annual: { label: "Yillik", start: "01-01", end: "12-31", range: "01.01 — 31.12" },
};

export type LayerKey =
  | "ebi" | "no2" | "so2" | "co" | "hcho" | "aai"
  | "ndvi" | "ndmi" | "ndsi" | "mndwi" | "lst" | "precip" | "lulc";

export interface LayerMeta {
  key: LayerKey;
  short: string;
  name: string;
  family: string;
  source: string;
  /** Xom GEE qiymatini ko'rsatish birligiga o'tkazish koeffitsienti */
  factor: number;
  unit: string;
  /** Qiymat oshishi ekologik holat yomonlashuvini bildiradimi */
  higherIsWorse: boolean;
  palette: string[];
  note: string;
  method: string;
  /** reduceRegion uchun masshtab (m) */
  scale: number;
  categorical?: boolean;
  /** Noldan boshlanadigan musbat miqdor — yillik o'zgarish foizda ko'rsatiladi */
  ratio?: boolean;
  /** Ma'lumot sifati muammosi aniqlangan davr */
  warning?: { from: string; to: string; text: string };
}

/**
 * Qatlamning o'z aniqligiga mos eng katta tile zoom darajasi. Undan yaqinroqda Leaflet
 * shu darajadagi tile'ni kattalashtiradi — GEE'ga keraksiz so'rov yuborilmaydi.
 * z8 ≈ 470 m/px, z12 ≈ 30 m/px, z13 ≈ 15 m/px (38.8° kenglikda).
 */
export const TILE_ZOOM: Record<LayerKey, number> = {
  no2: 8, so2: 8, co: 8, hcho: 8, aai: 8, precip: 8, // ~5.5 km piksel
  lst: 12, ebi: 12, // Landsat 30 m
  ndvi: 13, ndmi: 13, ndsi: 13, mndwi: 13, lulc: 13, // Sentinel-2 10–20 m
};

const RISK = ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"];

export const LAYERS: Record<LayerKey, LayerMeta> = {
  ebi: {
    key: "ebi", short: "EBI", name: "Ekologik bosim indeksi", family: "Kompleks baholash",
    source: "S5P + Sentinel-2 + Landsat", factor: 1, unit: "0–100", higherIsWorse: true, palette: RISK, scale: 1000,
    note: "NO₂, aerozol, yer harorati, o‘simlik qoplami, namlik va sho‘rlanish signallarining vaznli integral indeksi.",
    method: "EBI = 100 · (0.20·NO₂ + 0.10·AAI + 0.20·LST + 0.20·(1−NDVI) + 0.15·(1−NDMI) + 0.15·NDSI); har bir komponent 2019–2026 yillar uchun yagona p2–p98 shkalasida normallashtirilgan.",
  },
  no2: {
    key: "no2", short: "NO₂", ratio: true, name: "Azot dioksidi", family: "Atmosfera", source: "Sentinel-5P TROPOMI · ~5.5 km",
    factor: 1e6, unit: "µmol/m²", higherIsWorse: true, palette: RISK, scale: 1113,
    note: "Troposferadagi NO₂ ustun zichligi — transport, energetika va sanoat yonish jarayonlari indikatori.",
    method: "COPERNICUS/S5P/OFFL/L3_NO2 · tropospheric_NO2_column_number_density · cloud_fraction < 0.3 · mavsumiy mediana.",
  },
  so2: {
    key: "so2", short: "SO₂", name: "Oltingugurt dioksidi", family: "Atmosfera", source: "Sentinel-5P TROPOMI · ~5.5 km",
    factor: 1e6, unit: "µmol/m²", higherIsWorse: true, palette: RISK, scale: 1113,
    note: "SO₂ ustun zichligi — gaz qayta ishlash (Muborak, Sho‘rtan) va issiqlik elektr stansiyalari signali. Shovqin yuqori, tendensiyaga qarang.",
    method: "COPERNICUS/S5P/OFFL/L3_SO2 · SO2_column_number_density · cloud_fraction < 0.3 · mavsumiy mediana.",
    warning: {
      from: "2025-06-01",
      to: "2026-03-01",
      text: "2025-yil iyun – 2026-yil fevral oralig‘ida TROPOMI SO₂ mahsulotida viloyat sharqida keskin sakrashlar (oylik mediana 0–750 µmol/m²) qayd etilgan. Bu davr qiymatlari ishonchsiz — tendensiya xulosasi uchun ishlatmang.",
    },
  },
  co: {
    key: "co", short: "CO", ratio: true, name: "Uglerod monoksidi", family: "Atmosfera", source: "Sentinel-5P TROPOMI · ~7 km",
    factor: 1e3, unit: "mmol/m²", higherIsWorse: true, palette: RISK, scale: 1113,
    note: "Yoqilg‘i va biomassa to‘liq yonmasligi bilan bog‘liq atmosfera ustuni.",
    method: "COPERNICUS/S5P/OFFL/L3_CO · CO_column_number_density · mavsumiy mediana.",
  },
  hcho: {
    key: "hcho", short: "HCHO", ratio: true, name: "Formaldegid", family: "Atmosfera", source: "Sentinel-5P TROPOMI · ~5.5 km",
    factor: 1e6, unit: "µmol/m²", higherIsWorse: true, palette: RISK, scale: 1113,
    note: "Uchuvchan organik birikmalar (NMVOC) oksidlanishi proksisi; issiqlik va yong‘inlar ham ta’sir qiladi.",
    method: "COPERNICUS/S5P/OFFL/L3_HCHO · tropospheric_HCHO_column_number_density · cloud_fraction < 0.3 · mavsumiy mediana.",
  },
  aai: {
    key: "aai", short: "AAI", name: "Chang va aerozol", family: "Atmosfera", source: "Sentinel-5P TROPOMI · ~5.5 km",
    factor: 1, unit: "indeks", higherIsWorse: true, palette: RISK, scale: 1113,
    note: "Yutuvchi aerozol indeksi — chang bo‘ronlari va tutun. Qashqadaryo cho‘l zonasi uchun muhim signal.",
    method: "COPERNICUS/S5P/OFFL/L3_AER_AI · absorbing_aerosol_index (354/388 nm) · mavsumiy mediana.",
  },
  ndvi: {
    key: "ndvi", short: "NDVI", name: "O‘simlik qoplami", family: "Yer qoplami", source: "Sentinel-2 L2A · 10 m",
    factor: 1, unit: "−1…+1", higherIsWorse: false, scale: 250,
    palette: ["#a6611a", "#dfc27d", "#e6f5d0", "#7fbc41", "#1b7837"],
    note: "Yuqori qiymat — zich va faol yashil o‘simlik qoplami.",
    method: "(B8 − B4)/(B8 + B4) · Cloud Score+ (cs_cdf ≥ 0.6) bilan bulut maskasi · median kompozit.",
  },
  ndmi: {
    key: "ndmi", short: "NDMI", name: "O‘simlik namligi", family: "Yer qoplami", source: "Sentinel-2 L2A · 20 m",
    factor: 1, unit: "−1…+1", higherIsWorse: false, scale: 250,
    palette: ["#b35806", "#f1a340", "#fee0b6", "#74add1", "#2c7bb6"],
    note: "Past qiymat — vegetatsiya namligi tanqisligi, qurg‘oqchilik stressi ehtimoli.",
    method: "(B8 − B11)/(B8 + B11) · Cloud Score+ bulut maskasi · median kompozit.",
  },
  ndsi: {
    key: "ndsi", short: "NDSI", name: "Sho‘rlanish signali", family: "Yer qoplami", source: "Sentinel-2 L2A · 20 m",
    factor: 1, unit: "−1…+1", higherIsWorse: true, palette: RISK, scale: 250,
    note: "Spektral proksi; yalang‘och tuproqda ishonchliroq. Dala EC o‘lchovlari bilan tekshirilishi shart.",
    method: "(B11 − B12)/(B11 + B12) · Cloud Score+ bulut maskasi · median kompozit.",
  },
  mndwi: {
    key: "mndwi", short: "MNDWI", name: "Suv yuzasi", family: "Suv resurslari", source: "Sentinel-2 L2A · 20 m",
    factor: 1, unit: "−1…+1", higherIsWorse: false, scale: 250,
    palette: ["#f7f4ea", "#d9e6c8", "#9ecae1", "#4292c6", "#08306b"],
    note: "Musbat qiymatlar — ochiq suv (Chimqo‘rg‘on, Pachkamar, Talimarjon suv omborlari, kanallar).",
    method: "(B3 − B11)/(B3 + B11) · Cloud Score+ bulut maskasi · median kompozit.",
  },
  lst: {
    key: "lst", short: "LST", name: "Yer yuzasi harorati", family: "Issiqlik", source: "Landsat 8/9 C2 L2 · 30 m",
    factor: 1, unit: "°C", higherIsWorse: true, scale: 250,
    palette: ["#313695", "#74add1", "#fee090", "#f46d43", "#a50026"],
    note: "Bu havo harorati emas — sun’iy yo‘ldosh o‘lchagan yer sirtining harorati (taxm. 10:30 mahalliy vaqt).",
    method: "ST_B10 · 0.00341802 + 149 − 273.15 · QA_PIXEL bulut/soya maskasi · median kompozit.",
  },
  precip: {
    key: "precip", short: "Yog‘in", ratio: true, name: "Yog‘ingarchilik", family: "Iqlim", source: "CHIRPS · ~5.5 km",
    factor: 1, unit: "mm", higherIsWorse: false, scale: 5566,
    palette: ["#fff7bc", "#c7e9b4", "#7fcdbb", "#2c7fb8", "#253494"],
    note: "Mavsum davomidagi jami yog‘in miqdori — qurg‘oqchilik monitoringi uchun asosiy omil.",
    method: "UCSB-CHG/CHIRPS/DAILY · precipitation · mavsumiy yig‘indi.",
  },
  lulc: {
    key: "lulc", short: "LULC", name: "Yer qoplami sinflari", family: "Yer qoplami", source: "Dynamic World · 10 m",
    factor: 1, unit: "sinf", higherIsWorse: false, scale: 300, categorical: true,
    palette: ["#419bdf", "#397d49", "#88b053", "#7a87c6", "#e49635", "#dfc35a", "#c4281b", "#a59b8f", "#b39fe1"],
    note: "Google Dynamic World — mavsumdagi eng ko‘p uchragan sinf. Urbanizatsiya va qishloq xo‘jaligi o‘zgarishini kuzatish uchun.",
    method: "GOOGLE/DYNAMICWORLD/V1 · label · mavsumiy moda.",
  },
};

export const LULC_CLASSES = [
  "Suv", "Daraxtzor", "O‘tloq", "Botqoq o‘simlik", "Ekin maydoni", "Buta", "Qurilgan hudud", "Yalang‘och yer", "Qor/muz",
];

export const LAYER_GROUPS: { title: string; keys: LayerKey[] }[] = [
  { title: "Kompleks baholash", keys: ["ebi"] },
  { title: "Atmosfera", keys: ["no2", "so2", "co", "hcho", "aai"] },
  { title: "Yer qoplami", keys: ["ndvi", "ndmi", "ndsi", "lulc"] },
  { title: "Suv va iqlim", keys: ["mndwi", "precip"] },
  { title: "Issiqlik", keys: ["lst"] },
];

export const CLASS_LABELS = ["Juda past", "Past", "O‘rtacha", "Yuqori", "Juda yuqori"];

export const DIFF_PALETTE = ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"];

export const DISTRICT_NAMES: Record<string, string> = {
  "Chirakchi district": "Chiroqchi",
  "Dehkanabad district": "Dehqonobod",
  "Guzar district": "G‘uzor",
  "Kamashi district": "Qamashi",
  "Karshi city": "Qarshi shahri",
  "Karshi district": "Qarshi tumani",
  "Kasan district": "Koson",
  "Kasbi district": "Kasbi",
  "Kitab district": "Kitob",
  "Mirishkar district": "Mirishkor",
  "Mubarek district": "Muborak",
  "Nishan district": "Nishon",
  "Shakhrisabz district": "Shahrisabz",
  "Yakkabag district": "Yakkabog‘",
};

export function isLayer(k: string | null): k is LayerKey {
  return !!k && k in LAYERS;
}
export function isSeason(k: string | null): k is SeasonKey {
  return !!k && k in SEASONS;
}
export function isYear(y: number): y is Year {
  return (YEARS as readonly number[]).includes(y);
}

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : digits;
  return v.toLocaleString("uz-UZ", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
