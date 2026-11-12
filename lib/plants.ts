// Sanoat obyektlari va ularning chiqindilari tarqalish zonalari (manba: foydalanuvchi hujjatlari).

export interface PlantZone {
  /** Chiqindi tarkibi */
  label: string;
  radius_m: number;
  color: string;
}

export interface Plant {
  id: "muborak" | "shortan";
  name: string;
  short: string;
  district: string; // GAUL ADM2 id
  lat: number;
  lon: number;
  /** Koordinata sun'iy yo'ldosh suratida tasdiqlanganmi */
  verified: boolean;
  locationNote: string;
  zonesTitle: string;
  zones: PlantZone[];
  scheme: { src: string; caption: string };
  source: string;
}

export const PLANTS: Plant[] = [
  {
    id: "muborak",
    name: "Muborak gazni qayta ishlash zavodi",
    short: "Muborak GQIZ",
    district: "Mubarek district",
    lat: 39.1828,
    lon: 65.3123,
    verified: false,
    locationNote:
      "Taxminiy joylashuv: hujjatdagi koordinata (38°31′25″N, 66°08′30″E) sanoat obyektiga to‘g‘ri kelmaydi. Belgi Muborak IES yonidagi doimiy gaz mash’alasi (Sentinel-2 SWIR, 2024) ustiga qo‘yilgan.",
    zonesTitle: "Chiqindilarning atmosferada tarqalish masofasi",
    zones: [
      { label: "NO₂", radius_m: 400, color: "#fb923c" },
      { label: "NO", radius_m: 800, color: "#f97316" },
      { label: "H₂S + SO₂", radius_m: 14000, color: "#facc15" },
      { label: "H₂S + NH₃", radius_m: 15000, color: "#a3e635" },
      { label: "SO₂", radius_m: 16000, color: "#f43f5e" },
    ],
    scheme: {
      src: "/plants/muborak-sxema.jpg",
      caption: "MGQIZ chiqindilarining atmosferada tarqalish sxemasi (M 1:150 000). Zonalar shamol yo‘nalishi bo‘yicha cho‘zilgan ellips shaklida.",
    },
    source: "“Muborak gazni qayta ishlash zavodi” hujjati",
  },
  {
    id: "shortan",
    name: "Sho‘rtan gaz-kimyo majmuasi",
    short: "Sho‘rtan GKM",
    district: "Guzar district",
    lat: 38.461,
    lon: 65.798,
    verified: true,
    locationNote:
      "Joylashuv sun’iy yo‘ldosh suratida tasdiqlangan. Hujjatdagi koordinata (38°31′25″N, 66°08′30″E) majmuadan ~30 km sharqqa tushadi.",
    zonesTitle: "Ifloslovchi moddalarning tarqalish radiusi",
    zones: [
      { label: "300 m gacha", radius_m: 300, color: "#7f1d1d" },
      { label: "300–500 m", radius_m: 500, color: "#991b1b" },
      { label: "500–1000 m", radius_m: 1000, color: "#b91c1c" },
      { label: "1–2 km", radius_m: 2000, color: "#dc2626" },
      { label: "2–5 km", radius_m: 5000, color: "#ef4444" },
      { label: "5–10 km", radius_m: 10000, color: "#f87171" },
      { label: "10–20 km", radius_m: 20000, color: "#fca5a5" },
    ],
    scheme: {
      src: "/plants/shortan-sxema.jpg",
      caption: "Tuproqlarda og‘ir metallar (qo‘rg‘oshin, mis, rux, nikel) yalpi miqdori, 2017–2020 (M 1:100 000). Zonalar shimoli-g‘arb — janubi-sharq yo‘nalishida cho‘zilgan.",
    },
    source: "“Sho‘rtan gaz-kimyo zavodi” hujjati",
  },
];

/** GEE gradient tahlili uchun masofa halqalari (m) */
export const GRADIENT_RINGS = [0, 2000, 5000, 10000, 16000, 25000, 40000];

export function getPlant(id: string | null | undefined) {
  return PLANTS.find((p) => p.id === id) ?? null;
}
