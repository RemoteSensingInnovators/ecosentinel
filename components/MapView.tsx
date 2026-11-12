"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { BASEMAPS, type Basemap } from "@/lib/basemaps";
import { Icon } from "./Icons";
import { PLANTS, type Plant } from "@/lib/plants";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MapViewProps {
  tileUrl: string | null;
  /** Swipe rejimida o'ng tomondagi qatlam */
  compareUrl: string | null;
  compareLabels?: [string, string];
  opacity: number;
  /** Qatlam aniqligiga mos eng katta tile zoom (undan yuqorisi kattalashtiriladi) */
  nativeZoom: number;
  basemap: Basemap;
  showBounds: boolean;
  showLabels: boolean;
  districts: any | null;
  selectedDistrict: string | null;
  showPlants: boolean;
  selectedPlant: string | null;
  onPlantClick: (id: string) => void;
}

export default function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const base = useRef<L.TileLayer | null>(null);
  const labels = useRef<L.TileLayer | null>(null);
  const data = useRef<L.TileLayer | null>(null);
  const cmp = useRef<L.TileLayer | null>(null);
  const bounds = useRef<L.GeoJSON | null>(null);
  const plantLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [swipe, setSwipe] = useState(0.5);
  const swipeRef = useRef(0.5);
  swipeRef.current = swipe;
  const [loading, setLoading] = useState(0);

  // Xaritani yaratish
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 16, zoomSnap: 1 }).setView([38.75, 65.9], 8);
    m.attributionControl.setPrefix(false);
    L.control.zoom({ position: "bottomright", zoomInTitle: "Yaqinlashtirish", zoomOutTitle: "Uzoqlashtirish" }).addTo(m);
    L.control.scale({ position: "bottomright", imperial: false }).addTo(m);
    m.createPane("data").style.zIndex = "350";
    m.createPane("compare").style.zIndex = "360";
    m.createPane("bounds").style.zIndex = "420";
    m.createPane("labels").style.zIndex = "430";
    m.getPane("labels")!.style.pointerEvents = "none";
    m.createPane("plants").style.zIndex = "640";
    const clip = () => {
      const pane = m.getPane("compare")!;
      if (!cmp.current) { pane.style.clip = ""; return; }
      const nw = m.containerPointToLayerPoint([0, 0]);
      const se = m.containerPointToLayerPoint(m.getSize());
      const x = nw.x + m.getSize().x * swipeRef.current;
      pane.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${x}px)`;
    };
    m.on("move zoom resize", clip);
    (m as any)._clipCompare = clip;
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // Asos xarita
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    base.current?.remove();
    const b = BASEMAPS[props.basemap];
    base.current = L.tileLayer(b.url, { attribution: `${b.attr} · Google Earth Engine`, subdomains: "abc", maxZoom: b.maxZoom, maxNativeZoom: b.maxZoom }).addTo(m);
  }, [props.basemap]);

  // Joy nomlari
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    labels.current?.remove();
    labels.current = null;
    const b = BASEMAPS[props.basemap];
    if (props.showLabels && b.labels) labels.current = L.tileLayer(b.labels, { pane: "labels", maxZoom: 16 }).addTo(m);
  }, [props.basemap, props.showLabels]);

  const track = (t: L.TileLayer) => {
    t.on("loading", () => setLoading((n) => n + 1));
    t.on("load", () => setLoading((n) => Math.max(0, n - 1)));
    t.on("remove", () => setLoading(0));
    return t;
  };

  // Ma'lumot qatlami
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const prev = data.current;
    if (!props.tileUrl) { prev?.remove(); data.current = null; return; }
    const t = track(L.tileLayer(props.tileUrl, { pane: "data", opacity: props.opacity, maxZoom: 16, maxNativeZoom: propsRef.current.nativeZoom }));
    t.addTo(m);
    // eski qatlam yangisi yuklangach olib tashlanadi — miltillashsiz
    t.once("load", () => prev?.remove());
    setTimeout(() => prev?.remove(), 5000);
    data.current = t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tileUrl]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    cmp.current?.remove();
    cmp.current = null;
    if (props.compareUrl) {
      cmp.current = track(L.tileLayer(props.compareUrl, { pane: "compare", opacity: props.opacity, maxZoom: 16, maxNativeZoom: propsRef.current.nativeZoom })).addTo(m);
    }
    (m as any)._clipCompare?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.compareUrl]);

  useEffect(() => {
    data.current?.setOpacity(props.opacity);
    cmp.current?.setOpacity(props.opacity);
  }, [props.opacity]);

  useEffect(() => { (map.current as any)?._clipCompare?.(); }, [swipe]);

  // Viloyat konturi + tuman chegaralari
  useEffect(() => {
    const m = map.current;
    if (!m || !props.districts) return;
    bounds.current?.remove();
    const sel = props.selectedDistrict;
    const darkBase = props.basemap === "dark" || props.basemap === "satellite";
    if (props.showBounds) {
      bounds.current = L.geoJSON(props.districts, {
        pane: "bounds",
        interactive: false,
        style: (f) => {
          const on = f?.properties.id === sel;
          return { color: on ? (darkBase ? "#ffd166" : "#d97706") : darkBase ? "#ffffff" : "#1e293b", weight: on ? 2.8 : 0.9, opacity: on ? 1 : darkBase ? 0.5 : 0.6, fill: false, dashArray: on ? undefined : "2 4" };
        },
      }).addTo(m);
    } else if (sel) {
      bounds.current = L.geoJSON({ ...props.districts, features: props.districts.features.filter((f: any) => f.properties.id === sel) }, {
        pane: "bounds", interactive: false, style: { color: "#ffd166", weight: 2.8, fill: false },
      }).addTo(m);
    }
    if (!fitted.current) {
      fitted.current = true;
      // Zavod/tuman allaqachon tanlangan bo'lsa, ularga uchish ustun turadi
      if (!sel && !propsRef.current.selectedPlant) m.fitBounds(L.geoJSON(props.districts).getBounds(), { padding: [30, 30] });
    }
  }, [props.districts, props.selectedDistrict, props.showBounds, props.basemap]);

  // Tanlangan tumanga uchish
  useEffect(() => {
    const m = map.current;
    if (!m || !props.districts || !props.selectedDistrict) return;
    const f = props.districts.features.find((x: any) => x.properties.id === props.selectedDistrict);
    if (f) m.flyToBounds(L.geoJSON(f).getBounds(), { padding: [60, 60], duration: 0.6, maxZoom: 10 });
  }, [props.selectedDistrict, props.districts]);

  // Sanoat obyektlari va ta'sir zonalari
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    plantLayer.current?.remove();
    plantLayer.current = null;
    if (!props.showPlants) return;
    const g = L.layerGroup().addTo(m);
    const sel = PLANTS.find((p) => p.id === props.selectedPlant);
    if (sel) {
      // Yorliq faqat yirik halqalarga (eng kattasining ≥25%) — kichiklari markerga yopishib qoladi,
      // ular panel ro'yxatida bor. Diagonal yo'nalishlar: sharqdagi zavod nomi bilan to'qnashmaydi.
      const BEARINGS = [45, 135, 315, 225];
      const maxR = Math.max(...sel.zones.map((z) => z.radius_m));
      let li = 0;
      [...sel.zones].sort((a, b) => b.radius_m - a.radius_m).forEach((z) => {
        L.circle([sel.lat, sel.lon], {
          pane: "bounds", radius: z.radius_m, color: z.color, weight: 1.6, opacity: 0.95,
          dashArray: z.radius_m >= 5000 ? "6 5" : undefined, fillColor: z.color, fillOpacity: 0.05, interactive: false,
        }).addTo(g);
        if (z.radius_m < maxR * 0.25) return;
        // "10–20 km" kabi yorliqda masofa allaqachon bor — takrorlanmaydi
        const text = /\d\s*k?m\b/.test(z.label) ? z.label : `${z.label} · ${z.radius_m / 1000} km`;
        L.marker(destination(sel, z.radius_m, BEARINGS[li++ % BEARINGS.length]), {
          pane: "plants", interactive: false,
          icon: L.divIcon({ className: "zone-tag", html: `<span style="border-color:${z.color}">${text}</span>`, iconSize: [0, 0] }),
        }).addTo(g);
      });
    }
    PLANTS.forEach((p) => {
      const on = p.id === props.selectedPlant;
      L.marker([p.lat, p.lon], {
        pane: "plants",
        title: p.name,
        icon: L.divIcon({
          className: "plant-pin" + (on ? " on" : "") + (p.verified ? "" : " approx"),
          html: `<div class="pin"><svg viewBox="0 0 24 24"><path d="M4 20V10l4 2.5V10l4 2.5V7h3v13z"/><path d="M2.5 20h19"/><path d="M14.5 4.5c1-1.2 2.6-1.2 3.6 0s2.6 1.2 3.4 0"/></svg></div><b>${p.short}</b>`,
          iconSize: [34, 34], iconAnchor: [17, 17],
        }),
      }).on("click", () => propsRef.current.onPlantClick(p.id)).addTo(g);
    });
    plantLayer.current = g;
  }, [props.showPlants, props.selectedPlant]);

  // Tanlangan obyektga uchish
  useEffect(() => {
    const m = map.current;
    const p = PLANTS.find((x) => x.id === props.selectedPlant);
    if (!m || !p) return;
    const r = Math.max(...p.zones.map((z) => z.radius_m));
    m.flyToBounds(L.latLng(p.lat, p.lon).toBounds(r * 2.2), { duration: 0.6, maxZoom: 13 });
  }, [props.selectedPlant]);

  const resetView = () => {
    const m = map.current;
    if (m && props.districts) m.flyToBounds(L.geoJSON(props.districts).getBounds(), { padding: [30, 30], duration: 0.6 });
  };

  return (
    <div className="map-root">
      <div ref={el} className="map-canvas" />
      <button className="map-home" onClick={resetView} title="Butun viloyatni ko‘rsatish" aria-label="Butun viloyatni ko‘rsatish">
        <svg viewBox="0 0 24 24" aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {props.compareUrl && (
        <div className="swipe">
          <div className="swipe-line" style={{ left: `${swipe * 100}%` }}>
            <span><Icon name="swap" size={16} /></span>
          </div>
          {props.compareLabels && (
            <>
              <b className="swipe-tag left">{props.compareLabels[0]}</b>
              <b className="swipe-tag right">{props.compareLabels[1]}</b>
            </>
          )}
          <input aria-label="Taqqoslash chizig‘i" type="range" min={0} max={1} step={0.001} value={swipe} onChange={(e) => setSwipe(Number(e.target.value))} />
        </div>
      )}
      {loading > 0 && <div className="map-loading"><i /> Earth Engine hisoblamoqda…</div>}
    </div>
  );
}

/** Markazdan r metr va berilgan azimut (gradus, shimoldan soat yo'nalishida) bo'yicha nuqta */
function destination(p: Plant, r: number, bearing = 90): L.LatLngExpression {
  const b = (bearing * Math.PI) / 180;
  return [p.lat + (r * Math.cos(b)) / 111320, p.lon + (r * Math.sin(b)) / (111320 * Math.cos((p.lat * Math.PI) / 180))];
}
