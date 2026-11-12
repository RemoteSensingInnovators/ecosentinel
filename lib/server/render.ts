import { createSign } from "node:crypto";
import { ee, cached, getMapUrl, loadKey } from "./ee";
import { classify, displayCalib, displayImage, rawImage } from "./composites";
import { CLASS_LABELS, DIFF_PALETTE, LAYERS, LULC_CLASSES, isLayer, isSeason, isYear, type LayerKey, type SeasonKey } from "../layers";

export type Mode = "continuous" | "classes" | "diff";
export interface RenderSpec { layer: LayerKey; season: SeasonKey; year: number; mode: Mode; base: number | null }

export type Legend =
  | { kind: "continuous"; min: number; max: number; colors: string[] }
  | { kind: "classes"; breaks: number[]; colors: string[]; labels: string[] }
  | { kind: "categorical"; colors: string[]; labels: string[] }
  | { kind: "diff"; min: number; max: number; colors: string[] };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function build(spec: RenderSpec): { img: any; vis: Record<string, unknown>; legend: Legend } {
  const { layer, season, year, mode, base } = spec;
  const meta = LAYERS[layer];
  if (meta.categorical) {
    if (mode === "diff") {
      return {
        img: rawImage(layer, year, season).neq(rawImage(layer, base!, season)).selfMask(),
        vis: { min: 1, max: 1, palette: ["e8175d"] },
        legend: { kind: "categorical", colors: ["#e8175d"], labels: [`${base} → ${year} sinfi o‘zgargan`] },
      };
    }
    return {
      img: rawImage(layer, year, season),
      vis: { min: 0, max: 8, palette: meta.palette.map((c) => c.slice(1)) },
      legend: { kind: "categorical", colors: meta.palette, labels: LULC_CLASSES },
    };
  }
  const c = displayCalib(layer, season);
  if (!c) throw new Error("Kalibrovka topilmadi — npm run calibrate");
  const cur = displayImage(layer, year, season);
  if (mode === "diff") {
    const r = (c.p98 - c.p2) * 0.35;
    const colors = meta.higherIsWorse ? DIFF_PALETTE : [...DIFF_PALETTE].reverse();
    return {
      img: cur.subtract(displayImage(layer, base!, season)),
      vis: { min: -r, max: r, palette: colors.map((x) => x.slice(1)) },
      legend: { kind: "diff", min: -r, max: r, colors },
    };
  }
  if (mode === "classes") {
    return {
      img: classify(cur, c),
      vis: { min: 0, max: 4, palette: meta.palette.map((x) => x.slice(1)) },
      legend: { kind: "classes", breaks: [c.p20, c.p40, c.p60, c.p80], colors: meta.palette, labels: CLASS_LABELS },
    };
  }
  return {
    img: cur,
    vis: { min: c.p2, max: c.p98, palette: meta.palette.map((x) => x.slice(1)) },
    legend: { kind: "continuous", min: c.p2, max: c.p98, colors: meta.palette },
  };
}

export function encodeSpec(s: RenderSpec) {
  return [s.layer, s.season, s.year, s.mode, s.base ?? "-"].join(".");
}
export function decodeSpec(key: string): RenderSpec | null {
  const [layer, season, y, mode, b] = key.split(".");
  const year = Number(y), base = b === "-" ? null : Number(b);
  if (!isLayer(layer) || !isSeason(season) || !isYear(year) || !["continuous", "classes", "diff"].includes(mode)) return null;
  if (mode === "diff" && (base == null || !isYear(base))) return null;
  return { layer, season, year, mode: mode as Mode, base };
}

/* ---------- To'g'ridan-to'g'ri GEE map tile'lari (ruxsat bo'lsa) ---------- */
let mapsDenied = process.env.GEE_TILE_PROXY === "1";

export async function tileUrlFor(spec: RenderSpec): Promise<{ url: string; legend: Legend; proxied: boolean }> {
  const { img, vis, legend } = build(spec);
  if (!mapsDenied) {
    try {
      const url = await cached(`map:${encodeSpec(spec)}`, 4 * 3600 * 1000, () => getMapUrl(ee.Image(img), vis));
      return { url, legend, proxied: false };
    } catch (e) {
      if (/maps\.create|permission/i.test((e as Error).message)) mapsDenied = true;
      else throw e;
    }
  }
  return { url: `/api/tile/${encodeSpec(spec)}/{z}/{x}/{y}.png?v=3`, legend, proxied: true };
}

/* ---------- Tile proksi: image:computePixels (faqat computations ruxsati kerak) ---------- */
let token: { value: string; exp: number } | null = null;

export async function accessToken(): Promise<string> {
  if (token && Date.now() < token.exp - 120_000) return token.value;
  const k = loadKey();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: k.client_email,
    scope: "https://www.googleapis.com/auth/earthengine https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(k.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!r.ok) throw new Error(`OAuth xatosi: ${await r.text()}`);
  const j = await r.json();
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

const exprCache = new Map<string, unknown>();
function expression(spec: RenderSpec) {
  const k = encodeSpec(spec);
  if (!exprCache.has(k)) {
    const { img, vis } = build(spec);
    exprCache.set(k, JSON.parse(ee.Serializer.toCloudApiJSON(ee.Image(img).visualize(vis))));
  }
  return exprCache.get(k);
}

const HALF = 20037508.342789244;
// Qashqadaryo atrofidagi to'rtburchak (lon/lat) — tashqaridagi tile'lar hisoblanmaydi
const BBOX = [64.2, 37.5, 67.9, 39.8];

function tileLonLat(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lon, lat];
}

export function tileOutside(z: number, x: number, y: number) {
  const [w, n] = tileLonLat(z, x, y);
  const [e, s] = tileLonLat(z, x + 1, y + 1);
  return e < BBOX[0] || w > BBOX[2] || n < BBOX[1] || s > BBOX[3];
}

/* GEE'ga bir vaqtda yuboriladigan computePixels so'rovlarini cheklash — kvota to'lib,
   boshqa so'rovlar (statistika, health) 429 bilan bloklanmasligi uchun */
const MAX_PARALLEL = 12;
let active = 0;
const waiters: (() => void)[] = [];
async function slot(signal?: AbortSignal): Promise<() => void> {
  while (active >= MAX_PARALLEL) {
    await new Promise<void>((ok) => waiters.push(ok));
    if (signal?.aborted) {
      waiters.shift()?.(); // bo'shagan joyni navbatdagiga uzatish
      throw new Error("bekor qilindi");
    }
  }
  active++;
  return () => {
    active--;
    waiters.shift()?.();
  };
}

export async function renderTile(spec: RenderSpec, z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  const release = await slot(signal);
  try {
    return await computeTile(spec, z, x, y, signal);
  } finally {
    release();
  }
}

async function computeTile(spec: RenderSpec, z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (signal?.aborted) throw new Error("bekor qilindi");
  const res = (2 * HALF) / 256 / 2 ** z;
  const body = {
    expression: expression(spec),
    fileFormat: "PNG",
    grid: {
      dimensions: { width: 256, height: 256 },
      affineTransform: { scaleX: res, shearX: 0, translateX: -HALF + x * 256 * res, shearY: 0, scaleY: -res, translateY: HALF - y * 256 * res },
      crsCode: "EPSG:3857",
    },
  };
  const project = process.env.GEE_PROJECT || loadKey().project_id;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://earthengine.googleapis.com/v1/projects/${project}/image:computePixels`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Brauzer tile'ni bekor qilsa (xarita surildi) — GEE hisobi ham to'xtatiladi
      signal,
    });
    if (r.ok) return r.arrayBuffer();
    if ((r.status === 429 || r.status >= 500) && attempt < 2) {
      await new Promise((ok) => setTimeout(ok, 600 * (attempt + 1)));
      continue;
    }
    if (r.status === 401) token = null;
    throw new Error(`computePixels ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
}
