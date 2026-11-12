import type { LayerKey } from "@/lib/layers";

/** Qatlam ikonkasi foni va chizig'i uchun urg'u rangi */
export const LAYER_ACCENT: Record<LayerKey, string> = {
  ebi: "#f59e0b",
  no2: "#fb923c",
  so2: "#facc15",
  co: "#f87171",
  hcho: "#c084fc",
  aai: "#d6a35c",
  ndvi: "#4ade80",
  ndmi: "#22d3ee",
  ndsi: "#cbd5e1",
  lulc: "#f472b6",
  mndwi: "#60a5fa",
  precip: "#7dd3fc",
  lst: "#fb7185",
};

const LAYER_PATHS: Record<LayerKey, React.ReactNode> = {
  // Spidometr — integral bosim
  ebi: (<><path d="M4 16a8 8 0 0 1 16 0" /><path d="M12 16l4.5-5" /><circle cx="12" cy="16" r="1.4" fill="currentColor" /><path d="M6.5 11.5l1 .8M12 8v1.2M17.5 11.5l-1 .8" /></>),
  // Avtomobil chiqindisi / zavod quvuri tutuni
  no2: (<><path d="M4 20V10l4 2.5V10l4 2.5V7h3v13z" /><path d="M2.5 20h19" /><path d="M14.5 4.5c1-1.2 2.6-1.2 3.6 0s2.6 1.2 3.4 0" /></>),
  // Gaz qayta ishlash — alanga va quvur
  so2: (<><path d="M7 20h10" /><path d="M9 20v-6h6v6" /><path d="M12 3c.6 2.2 3 3 3 5.8a3 3 0 0 1-6 0c0-1.5.9-2.2 1.2-3.3.8.6 1.3 1.3 1.3 2 .3-1.6.2-3 .5-4.5z" /></>),
  // Yonish — alanga
  co: (<><path d="M12 3c1 3.6 5 5 5 9.8a5 5 0 0 1-10 0c0-2.8 1.6-3.9 2.2-5.7 1.1 1 1.9 2 1.9 3.2.6-2.6.4-4.9.9-7.3z" /><path d="M10.4 16.5a1.8 1.8 0 0 0 3.2 0" /></>),
  // Molekula
  hcho: (<><circle cx="12" cy="10" r="2.6" /><circle cx="12" cy="3.6" r="1.4" /><circle cx="5.5" cy="17" r="1.8" /><circle cx="18.5" cy="17" r="1.8" /><path d="M12 5v2.4M10.2 12l-3.3 3.6M13.8 12l3.3 3.6" /></>),
  // Chang bo'roni — shamol
  aai: (<><path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 16h7" /><circle cx="6" cy="20" r=".6" fill="currentColor" /><circle cx="10" cy="19.5" r=".6" fill="currentColor" /><circle cx="14" cy="20.5" r=".6" fill="currentColor" /></>),
  // Barg
  ndvi: (<><path d="M5 19C5 10.5 10.5 5 20 4c-.5 9.5-6 15-15 15z" /><path d="M5 19l8.5-8.5" /></>),
  // Tomchi
  ndmi: (<><path d="M12 3.5s6 6.6 6 10.8a6 6 0 0 1-12 0C6 10.1 12 3.5 12 3.5z" /><path d="M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8" /></>),
  // Tuz kristallari tuproq ustida
  ndsi: (<><path d="M3 19h18" /><path d="M2.5 22h5M10 22h4M16.5 22h5" /><path d="M8 9.5l3-3 3 3-3 3z" /><path d="M14.5 14l2.5-2.5 2.5 2.5-2.5 2.5z" /><path d="M4.5 15l2-2 2 2-2 2z" /></>),
  // Qatlamlar — yer qoplami sinflari
  lulc: (<><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z" /><path d="M3.5 12.2l8.5 4.5 8.5-4.5" /><path d="M3.5 16.2l8.5 4.5 8.5-4.5" /></>),
  // Suv to'lqinlari
  mndwi: (<><path d="M3 8.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" /><path d="M3 13c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" /><path d="M3 17.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" /></>),
  // Yomg'irli bulut
  precip: (<><path d="M7 14.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.6 3.3 3.3 0 0 1-.2 6.4z" /><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5" /></>),
  // Termometr
  lst: (<><path d="M10 13.6V5a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0z" /><path d="M12 9v7" /><circle cx="12" cy="17" r="1.6" fill="currentColor" /><path d="M17 6h2.5M17 9h2" /></>),
};

export function LayerIcon({ layer, size = 18 }: { layer: LayerKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {LAYER_PATHS[layer]}
    </svg>
  );
}

type UiName = "menu" | "close" | "swap" | "play" | "pause" | "gradient" | "classes" | "diff" | "compare" | "pin" | "layers";

const UI_PATHS: Record<UiName, React.ReactNode> = {
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  swap: (<path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />),
  play: (<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />),
  pause: (<path d="M8 5.5v13M16 5.5v13" strokeWidth={3} />),
  gradient: (<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M8 5v14M12.5 5v14M17 5v14" strokeOpacity={0.45} /></>),
  classes: (<><rect x="3.5" y="4" width="7" height="7" rx="1.5" /><rect x="13.5" y="4" width="7" height="7" rx="1.5" /><rect x="3.5" y="13" width="7" height="7" rx="1.5" /><rect x="13.5" y="13" width="7" height="7" rx="1.5" /></>),
  diff: (<><path d="M12 4v7M8.5 7.5h7" /><path d="M8.5 17h7" /><path d="M4 20L20 4" strokeOpacity={0.4} /></>),
  compare: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M12 2.5v19" /><path d="M7 10l-1.5 2L7 14M17 10l1.5 2L17 14" /></>),
  pin: (<><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>),
  layers: (<><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z" /><path d="M3.5 12.5l8.5 4.5 8.5-4.5" /></>),
};

export function Icon({ name, size = 16 }: { name: UiName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {UI_PATHS[name]}
    </svg>
  );
}
