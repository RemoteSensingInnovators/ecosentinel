"use client";

import { useEffect, useState } from "react";
import { LAYERS, fmt, type LayerKey, type SeasonKey } from "@/lib/layers";
import { classIndex, type Calib } from "@/lib/calib";
import { DISTRICT_NAMES } from "@/lib/layers";
import type { Plant } from "@/lib/plants";
import { Icon, LayerIcon } from "./Icons";

interface Ring { from: number; to: number; mean: number | null }

const km = (m: number) => (m >= 1000 ? `${fmt(m / 1000)} km` : `${m} m`);

export default function PlantPanel({ plant, layer, season, year, unit, calib, regionMean, onClose }: {
  plant: Plant;
  layer: LayerKey;
  season: SeasonKey;
  year: number;
  unit: string;
  calib: Calib | null;
  regionMean: number | null;
  onClose: () => void;
}) {
  const meta = LAYERS[layer];
  const [rings, setRings] = useState<Ring[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (meta.categorical) { setRings(null); setErr(null); return; }
    let live = true;
    setRings(null); setErr(null);
    fetch(`/api/plant?id=${plant.id}&layer=${layer}&season=${season}&year=${year}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j as Ring[]; })
      .then((j) => live && setRings(j))
      .catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [plant.id, layer, season, year, meta.categorical]);

  useEffect(() => {
    if (!zoom) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [zoom]);

  const vals = (rings ?? []).map((r) => r.mean).filter((v): v is number => v != null);
  const ref = regionMean ?? null;
  const lo = Math.min(...vals, ref ?? Infinity), hi = Math.max(...vals, ref ?? -Infinity);
  const pos = (v: number) => (hi === lo ? 100 : 8 + (92 * (v - lo)) / (hi - lo));
  const near = rings?.[0]?.mean ?? null;
  const nearDiff = near != null && ref ? ((near - ref) / Math.abs(ref)) * 100 : null;
  const coarse = meta.scale > 1000;

  return (
    <section className="card plant">
      <header className="plant-head">
        <i className="ico" style={{ color: "#f472b6", background: "#f472b61f", boxShadow: "inset 0 0 0 1px #f472b640" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10l4 2.5V10l4 2.5V7h3v13z" /><path d="M2.5 20h19" /><path d="M14.5 4.5c1-1.2 2.6-1.2 3.6 0s2.6 1.2 3.4 0" /></svg>
        </i>
        <div>
          <span className="eyebrow">Sanoat obyekti · {DISTRICT_NAMES[plant.district]}</span>
          <h3>{plant.name}</h3>
        </div>
        <button className="x" onClick={onClose} aria-label="Yopish"><Icon name="close" size={16} /></button>
      </header>

      <p className={`loc ${plant.verified ? "ok" : "warn"}`}>
        <b>{plant.lat.toFixed(4)}°N, {plant.lon.toFixed(4)}°E</b>
        <span>{plant.verified ? "✓ tasdiqlangan" : "taxminiy"}</span>
      </p>
      <p className="muted small">{plant.locationNote}</p>

      <h4>{plant.zonesTitle}</h4>
      <ul className="zones">
        {plant.zones.map((z) => (
          <li key={z.label}>
            <i style={{ borderColor: z.color, background: `${z.color}22` }} />
            <span>{z.label}</span>
            <b>{km(z.radius_m)}</b>
          </li>
        ))}
      </ul>

      {!meta.categorical && (
        <>
          <h4 className="with-ico"><LayerIcon layer={layer} size={14} /> {meta.short}: masofa bo‘yicha gradient · {year}</h4>
          {err && <p className="err">{err}</p>}
          {!rings && !err && <div className="skeleton" style={{ height: 150 }} />}
          {rings && (
            <>
              <ol className="gradient">
                {rings.map((r) => {
                  const color = r.mean != null && calib ? meta.palette[classIndex(r.mean, calib)] : "var(--line-2)";
                  return (
                    <li key={r.to}>
                      <span className="nm">{km(r.from)}–{km(r.to)}</span>
                      <span className="bar">
                        {r.mean != null && <i style={{ width: `${pos(r.mean)}%`, background: color }} />}
                        {ref != null && <em style={{ left: `${pos(ref)}%` }} title="Viloyat o‘rtachasi" />}
                      </span>
                      <b>{fmt(r.mean)}</b>
                    </li>
                  );
                })}
              </ol>
              <p className="muted small">
                <span className="ref-key" /> viloyat o‘rtachasi {fmt(ref)} {unit}.
                {nearDiff != null && <> Zavod yaqinida (0–2 km) qiymat undan <b className={(nearDiff > 0) === meta.higherIsWorse ? "bad" : "good"}>{nearDiff > 0 ? "+" : ""}{fmt(nearDiff, 1)}%</b> farq qiladi.</>}
                {coarse && " Sentinel-5P pikseli ~5.5 km bo‘lgani uchun yaqin halqalar silliqlangan."}
              </p>
            </>
          )}
        </>
      )}

      <button className="scheme" onClick={() => setZoom(true)}>
        <img src={plant.scheme.src} alt={plant.scheme.caption} loading="lazy" />
        <span>Hujjatdagi sxemani kattalashtirish</span>
      </button>
      <p className="muted small">Manba: {plant.source}. Xaritadagi zonalar sxemadagi radiuslar bo‘yicha aylana sifatida chizilgan.</p>

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-label={plant.name}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={plant.scheme.src} alt={plant.scheme.caption} />
            <figcaption>{plant.scheme.caption}</figcaption>
            <button onClick={() => setZoom(false)} aria-label="Yopish"><Icon name="close" size={18} /></button>
          </figure>
        </div>
      )}
    </section>
  );
}
