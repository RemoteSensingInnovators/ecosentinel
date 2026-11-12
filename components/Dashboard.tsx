"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLASS_LABELS, LAYER_GROUPS, LAYERS, LULC_CLASSES, SEASONS, YEARS, fmt,
  TILE_ZOOM, isLayer, isSeason, isYear, type LayerKey, type LayerMeta, type SeasonKey,
} from "@/lib/layers";
import { classIndex, displayCalib } from "@/lib/calib";
import TrendChart, { mannKendallZ, senSlope, type Series } from "./TrendChart";
import { BASEMAPS, type Basemap } from "@/lib/basemaps";
import { Icon, LayerIcon, LAYER_ACCENT } from "./Icons";
import { PLANTS, getPlant } from "@/lib/plants";
import PlantPanel from "./PlantPanel";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map-root map-placeholder"><i className="spin" /> Xarita yuklanmoqda…</div> });

type Mode = "continuous" | "classes" | "diff" | "swipe";
type Legend =
  | { kind: "continuous"; min: number; max: number; colors: string[] }
  | { kind: "classes"; breaks: number[]; colors: string[]; labels: string[] }
  | { kind: "categorical"; colors: string[]; labels: string[] }
  | { kind: "diff"; min: number; max: number; colors: string[] };
interface Tile { url: string; legend: Legend }
interface DistrictStat { id: string; name: string; mean: number | null; p10?: number | null; p90?: number | null; shares?: number[] }
interface Stats { region: { mean: number | null; p10?: number | null; p90?: number | null; shares?: number[] }; districts: DistrictStat[] }
interface SeriesPoint { year: number; mean: number | null; shares?: number[] }
type DistrictsGj = { features: { properties: { id: string; name: string; area_km2: number } }[] };

const MODES: { key: Mode; label: string; hint: string; icon: "gradient" | "classes" | "diff" | "compare" }[] = [
  { key: "continuous", label: "Uzluksiz", hint: "Qiymatlar gradienti", icon: "gradient" },
  { key: "classes", label: "5 sinf", hint: "Yagona shkaladagi xavf sinflari", icon: "classes" },
  { key: "diff", label: "O‘zgarish", hint: "Tanlangan yil − bazaviy yil", icon: "diff" },
  { key: "swipe", label: "Taqqoslash", hint: "Ikki yilni surgich bilan solishtirish", icon: "compare" },
];
const LULC_TRACK = [6, 4, 7, 0]; // Qurilgan, Ekin, Yalang'och, Suv
const LULC_COLORS = LAYERS.lulc.palette;

/** Indekslar uchun "−1…+1" kabi diapazon birlik emas */
const unitOf = (m: LayerMeta) => (m.unit.includes("…") || m.unit === "0–100" || m.unit === "indeks" ? "" : m.unit);

const memo = new Map<string, Promise<unknown>>();
function getJSON<T>(url: string): Promise<T> {
  if (!memo.has(url)) {
    memo.set(url, fetch(url).then(async (r) => {
      const j = await r.json().catch(() => ({ error: r.statusText }));
      if (!r.ok) { memo.delete(url); throw new Error(j.error || `HTTP ${r.status}`); }
      return j;
    }));
  }
  return memo.get(url) as Promise<T>;
}

function useAsync<T>(url: string | null) {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  useEffect(() => {
    if (!url) { set({ data: null, error: null, loading: false }); return; }
    let live = true;
    set((s) => ({ ...s, loading: true, error: null }));
    getJSON<T>(url).then((d) => live && set({ data: d, error: null, loading: false }))
      .catch((e: Error) => live && set({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [url]);
  return state;
}

function isPartial(year: number, season: SeasonKey) {
  const end = season === "annual" ? `${year + 1}-01-01` : `${year}-${SEASONS[season].end}`;
  return new Date(end) > new Date();
}

function readHash() {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const layer = h.get("layer"), season = h.get("season"), year = Number(h.get("year")), mode = h.get("mode"), bm = h.get("map");
  return {
    layer: isLayer(layer) ? layer : undefined,
    season: isSeason(season) ? season : undefined,
    year: isYear(year) ? year : undefined,
    mode: MODES.some((m) => m.key === mode) ? (mode as Mode) : undefined,
    basemap: bm && bm in BASEMAPS ? (bm as Basemap) : undefined,
    plant: getPlant(h.get("plant"))?.id,
  };
}

export default function Dashboard() {
  const [layer, setLayer] = useState<LayerKey>("ebi");
  const [season, setSeason] = useState<SeasonKey>("summer");
  const [year, setYear] = useState<number>(2025);
  const [baseYear, setBaseYear] = useState<number>(2019);
  const [mode, setMode] = useState<Mode>("continuous");
  const [opacity, setOpacity] = useState(0.85);
  const [basemap, setBasemap] = useState<Basemap>("dark");
  const [showBounds, setShowBounds] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [mapPanel, setMapPanel] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [district, setDistrict] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [showPlants, setShowPlants] = useState(true);
  const [districtsGj, setDistrictsGj] = useState<DistrictsGj | null>(null);
  const [health, setHealth] = useState<"wait" | "ok" | "busy" | "fail">("wait");
  const [healthErr, setHealthErr] = useState("");
  const [lulcClass, setLulcClass] = useState(6);
  const [menuOpen, setMenuOpen] = useState(false);
  const hydrated = useRef(false);
  // URL holati o'qilmaguncha so'rov yuborilmaydi (aks holda standart qatlam uchun ortiqcha hisob ketadi)
  const [ready, setReady] = useState(false);

  const meta = LAYERS[layer];
  const cat = !!meta.categorical;
  const unit = unitOf(meta);

  // URL hash <-> holat
  useEffect(() => {
    const h = readHash();
    if (h.layer) setLayer(h.layer);
    if (h.season) setSeason(h.season);
    if (h.year) setYear(h.year);
    if (h.mode) setMode(h.mode);
    if (h.basemap) setBasemap(h.basemap);
    if (h.plant) setPlantId(h.plant);
    hydrated.current = true;
    setReady(true);
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    history.replaceState(null, "", `#layer=${layer}&year=${year}&season=${season}&mode=${mode}&map=${basemap}${plantId ? `&plant=${plantId}` : ""}`);
  }, [layer, year, season, mode, basemap, plantId]);

  useEffect(() => {
    fetch("/districts.geojson").then((r) => r.json()).then(setDistrictsGj).catch(() => {});
    fetch("/api/health", { signal: AbortSignal.timeout(30000) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setHealth(!r.ok ? "fail" : j.busy ? "busy" : "ok");
        if (!r.ok) setHealthErr(typeof j.error === "string" ? j.error : `HTTP ${r.status}`);
      })
      .catch((e) => { setHealth("fail"); setHealthErr(e instanceof Error ? e.message : String(e)); });
  }, []);

  useEffect(() => { if (cat && mode === "classes") setMode("continuous"); }, [cat, mode]);
  useEffect(() => {
    if (baseYear === year) setBaseYear(year === YEARS[0] ? YEARS[YEARS.length - 1] : YEARS[0]);
  }, [year, baseYear]);

  // Animatsiya
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setYear((y) => (y >= YEARS[YEARS.length - 1] ? YEARS[0] : y + 1)), 2800);
    return () => window.clearInterval(id);
  }, [playing]);

  const tileQuery = (y: number, m: "continuous" | "classes" | "diff") =>
    `/api/tiles?layer=${layer}&season=${season}&year=${y}&mode=${m}${m === "diff" ? `&base=${baseYear}` : ""}`;
  const tile = useAsync<Tile>(!ready ? null : mode === "swipe" ? tileQuery(baseYear, "continuous") : tileQuery(year, mode));
  const cmpTile = useAsync<Tile>(ready && mode === "swipe" ? tileQuery(year, "continuous") : null);

  useEffect(() => {
    if (playing && mode !== "swipe") YEARS.forEach((y) => getJSON(tileQuery(y, mode)).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, layer, season, mode]);

  const stats = useAsync<Stats>(!ready ? null : `/api/stats?layer=${layer}&season=${season}&year=${year}`);
  const regionSeries = useAsync<SeriesPoint[]>(!ready ? null : `/api/series?layer=${layer}&season=${season}`);
  const districtSeries = useAsync<SeriesPoint[]>(ready && district ? `/api/series?layer=${layer}&season=${season}&district=${encodeURIComponent(district)}` : null);
  const plantSeries = useAsync<SeriesPoint[]>(ready && plantId ? `/api/series?layer=${layer}&season=${season}&plant=${plantId}` : null);
  const plant = getPlant(plantId);

  const districtName = useCallback((id: string | null) => districtsGj?.features.find((f) => f.properties.id === id)?.properties.name ?? id ?? "", [districtsGj]);
  const districtList = useMemo(
    () => [...(districtsGj?.features ?? [])].map((f) => f.properties).sort((a, b) => a.name.localeCompare(b.name, "uz")),
    [districtsGj],
  );

  const calib = useMemo(() => (cat ? null : displayCalib(layer, season)), [layer, season, cat]);

  // Grafik seriyalari
  const chartSeries: Series[] = useMemo(() => {
    if (cat) {
      const src = (plant ? plantSeries.data : district ? districtSeries.data : regionSeries.data) ?? [];
      return LULC_TRACK.map((c) => ({ label: LULC_CLASSES[c], color: LULC_COLORS[c], points: src.map((p) => ({ year: p.year, value: p.shares?.[c] ?? null })) }));
    }
    const out: Series[] = [];
    if (regionSeries.data) out.push({ label: "Viloyat", color: "#8ecae6", points: regionSeries.data.map((p) => ({ year: p.year, value: p.mean })) });
    if (district && districtSeries.data) out.push({ label: districtName(district), color: "#ffd166", points: districtSeries.data.map((p) => ({ year: p.year, value: p.mean })) });
    if (plant && plantSeries.data) out.push({ label: plant.short, color: "#f472b6", points: plantSeries.data.map((p) => ({ year: p.year, value: p.mean })) });
    return out;
  }, [cat, district, districtSeries.data, regionSeries.data, plant, plantSeries.data, districtName]);

  const scopeLabel = plant ? plant.short : district ? districtName(district) : "Viloyat";
  const focusSeries = chartSeries.find((s) => s.label === scopeLabel);
  const slope = !cat && focusSeries ? senSlope(focusSeries.points) : null;
  const mkz = !cat && focusSeries ? mannKendallZ(focusSeries.points) : null;
  const curVal = focusSeries?.points.find((p) => p.year === year)?.value ?? null;
  const prevVal = focusSeries?.points.find((p) => p.year === year - 1)?.value ?? null;
  // Foiz faqat noldan boshlanadigan musbat miqdorlar uchun ma'noli (gaz miqdori, yog'in).
  // Indekslar (NDVI, NDMI…), °C va manfiy bo'lishi mumkin bo'lgan SO₂ uchun mutlaq farq ko'rsatiladi.
  const delta = curVal != null && prevVal != null ? curVal - prevVal : null;
  const deltaPct = meta.ratio && delta != null && prevVal! > 0 ? (delta / prevVal!) * 100 : null;
  const tone = (v: number | null) => (v == null || v === 0 ? "" : (v > 0) === meta.higherIsWorse ? "bad" : "good");

  const ranking = useMemo(() => {
    const d = stats.data?.districts ?? [];
    const val = (s: DistrictStat) => (cat ? s.shares?.[lulcClass] ?? null : s.mean);
    return [...d].filter((s) => val(s) != null).sort((a, b) => (meta.higherIsWorse || cat ? val(b)! - val(a)! : val(a)! - val(b)!)).map((s) => ({ ...s, v: val(s)! }));
  }, [stats.data, cat, lulcClass, meta.higherIsWorse]);
  const rMax = Math.max(...ranking.map((r) => r.v), 0), rMin = Math.min(...ranking.map((r) => r.v), 0);

  const legend = (mode === "swipe" ? cmpTile.data ?? tile.data : tile.data)?.legend;
  const partial = isPartial(year, season);
  const warning = (() => {
    const w = meta.warning;
    if (!w) return null;
    const ys = mode === "diff" || mode === "swipe" ? [year, baseYear] : [year];
    const hit = ys.some((y) => {
      const s0 = `${y}-${SEASONS[season].start}`, s1 = season === "annual" ? `${y + 1}-01-01` : `${y}-${SEASONS[season].end}`;
      return s0 < w.to && s1 > w.from;
    });
    return hit ? w.text : null;
  })();
  const twoYears = mode === "diff" || mode === "swipe";

  return (
    <main className="shell">
      <header className="topbar">
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Qatlamlar"><Icon name="menu" size={18} /></button>
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 18c5-6 9 2 13-3s6-4 9-2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="16" cy="16" r="2.5" fill="currentColor" /></svg>
          </div>
          <div>
            <h1>EcoSentinel</h1>
            <span>Qashqadaryo geoekologik monitoringi</span>
          </div>
        </div>
        <div className="top-meta">
          <span className="pill">{YEARS[0]}–{YEARS[YEARS.length - 1]}</span>
          <span className="pill">14 tuman</span>
          <span className={`status ${health}`} title={healthErr || undefined}><i />{health === "ok" ? "Earth Engine ulangan" : health === "busy" ? "Earth Engine band" : health === "fail" ? (healthErr.includes("GEE_SERVICE_ACCOUNT_KEY") ? "GEE kaliti sozlanmagan" : "GEE bilan aloqa yo‘q") : "GEE tekshirilmoqda"}</span>
        </div>
      </header>

      <div className="grid">
        {/* Chap panel — qatlamlar */}
        <aside className={`side left ${menuOpen ? "open" : ""}`}>
          <div className="block">
            <span className="eyebrow">Mavsum</span>
            <div className="seg seasons" role="tablist" aria-label="Mavsum">
              {(Object.keys(SEASONS) as SeasonKey[]).map((s) => (
                <button key={s} role="tab" aria-selected={season === s} className={season === s ? "on" : ""} onClick={() => setSeason(s)}>{SEASONS[s].label}</button>
              ))}
            </div>
          </div>
          <nav className="layer-list" aria-label="Ko‘rsatkichlar">
            {LAYER_GROUPS.map((g) => (
              <section key={g.title}>
                <h3 className="eyebrow">{g.title}</h3>
                {g.keys.map((k) => (
                  <button key={k} className={`layer ${layer === k ? "on" : ""}`} onClick={() => { setLayer(k); setMenuOpen(false); }} aria-pressed={layer === k}>
                    <i className="ico" style={{ color: LAYER_ACCENT[k], background: `${LAYER_ACCENT[k]}1f`, boxShadow: `inset 0 0 0 1px ${LAYER_ACCENT[k]}40` }}><LayerIcon layer={k} /></i>
                    <span><b>{LAYERS[k].short}</b><small>{LAYERS[k].name}</small></span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
          <p className="side-foot">Sentinel-5P · Sentinel-2 · Landsat 8/9 · CHIRPS · Dynamic World<br />Google Earth Engine orqali hisoblanadi</p>
        </aside>
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

        {/* Xarita */}
        <section className="stage">
          <div className="toolbar">
            <div className="title">
              <i className="ico big" style={{ color: LAYER_ACCENT[layer], background: `${LAYER_ACCENT[layer]}1f`, boxShadow: `inset 0 0 0 1px ${LAYER_ACCENT[layer]}40` }}><LayerIcon layer={layer} size={22} /></i>
              <div>
              <span className="eyebrow">{meta.family} · {meta.source}</span>
              <h2>{meta.name} <small>{meta.short}</small></h2>
              </div>
            </div>
            <div className="seg modes" role="tablist" aria-label="Ko‘rinish rejimi">
              {MODES.filter((m) => !(cat && m.key === "classes")).map((m) => (
                <button key={m.key} title={m.hint} className={mode === m.key ? "on" : ""} onClick={() => setMode(m.key)}><Icon name={m.icon} size={14} />{m.label}</button>
              ))}
            </div>
          </div>

          <div className="map-wrap">
            <MapView
              tileUrl={tile.data?.url ?? null}
              compareUrl={mode === "swipe" ? cmpTile.data?.url ?? null : null}
              compareLabels={[String(baseYear), String(year)]}
              opacity={opacity}
              nativeZoom={TILE_ZOOM[layer]}
              basemap={basemap}
              showBounds={showBounds}
              showLabels={showLabels}
              districts={districtsGj}
              selectedDistrict={district}
              showPlants={showPlants}
              selectedPlant={plantId}
              onPlantClick={(id) => { setPlantId(id); setDistrict(null); setShowPlants(true); }}
            />

            {mode !== "swipe" && (
              <div className="map-chip">
                <b>{mode === "diff" ? `${baseYear} → ${year}` : year}</b>
                <span>{SEASONS[season].label} · {meta.short}</span>
                {partial && <em>davom etmoqda</em>}
                {warning && <em className="bad">ishonchsiz</em>}
              </div>
            )}

            {/* Asos xarita paneli */}
            <div className={`map-ctl ${mapPanel ? "open" : ""}`}>
              <button className="map-ctl-btn" onClick={() => setMapPanel(!mapPanel)} aria-expanded={mapPanel} title="Asos xarita va qatlam sozlamalari">
                <img src={BASEMAPS[basemap].preview} alt="" />
                <span>Xarita</span>
              </button>
              {mapPanel && (
                <div className="map-ctl-panel">
                  <header><span className="eyebrow">Asos xarita</span><button onClick={() => setMapPanel(false)} aria-label="Yopish"><Icon name="close" size={16} /></button></header>
                  <div className="bm-grid">
                    {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
                      <button key={b} className={basemap === b ? "on" : ""} onClick={() => setBasemap(b)}>
                        <img src={BASEMAPS[b].preview} alt="" loading="lazy" />
                        <span>{BASEMAPS[b].label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="toggles">
                    <label><input type="checkbox" checked={showBounds} onChange={(e) => setShowBounds(e.target.checked)} /><span>Tuman chegaralari</span></label>
                    <label><input type="checkbox" checked={showPlants} onChange={(e) => setShowPlants(e.target.checked)} /><span>Sanoat obyektlari</span></label>
                    <label className={BASEMAPS[basemap].labels ? "" : "dis"}><input type="checkbox" checked={showLabels} disabled={!BASEMAPS[basemap].labels} onChange={(e) => setShowLabels(e.target.checked)} /><span>Joy nomlari</span></label>
                  </div>
                  <div className="opacity">
                    <label><span>Qatlam shaffofligi</span><b>{Math.round(opacity * 100)}%</b></label>
                    <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                  </div>
                </div>
              )}
            </div>

            {(tile.error || cmpTile.error) && (
              <div className="map-error">
                <b>Earth Engine xatosi</b>
                <p>{tile.error || cmpTile.error}</p>
                <button onClick={() => { memo.clear(); location.reload(); }}>Qayta urinish</button>
              </div>
            )}
            {legend && <LegendBox legend={legend} unit={unit} mode={mode} />}
          </div>

          <div className="timeline">
            <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? "To‘xtatish" : "Yillar animatsiyasi"}>
              {playing ? <Icon name="pause" size={16} /> : <Icon name="play" size={16} />}
            </button>
            <div className="years">
              {YEARS.map((y) => (
                <button key={y} className={`${y === year ? "on" : ""} ${twoYears && y === baseYear ? "base" : ""}`} onClick={() => { setYear(y); setPlaying(false); }}>
                  <i /><span>{y}</span>
                </button>
              ))}
            </div>
            {twoYears && (
              <label className="base-select">
                <span>Bazaviy yil</span>
                <select value={baseYear} onChange={(e) => setBaseYear(Number(e.target.value))}>
                  {YEARS.filter((y) => y !== year).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            )}
          </div>
        </section>

        {/* O'ng panel — tahlil */}
        <aside className="side right">
          {warning && <div className="quality-warn" role="alert"><b>Ma’lumot sifati</b><p>{warning}</p></div>}

          <div className="region-pick">
            <label htmlFor="district" className="eyebrow">Hudud</label>
            <div className="select-wrap">
              <select id="district" value={plantId ? `plant:${plantId}` : district ?? ""} onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("plant:")) { setPlantId(v.slice(6)); setDistrict(null); setShowPlants(true); }
                else { setPlantId(null); setDistrict(v || null); }
              }}>
                <option value="">Qashqadaryo viloyati</option>
                <optgroup label="Tumanlar">
                  {districtList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
                <optgroup label="Sanoat obyektlari (ta’sir zonasi)">
                  {PLANTS.map((p) => <option key={p.id} value={`plant:${p.id}`}>{p.name}</option>)}
                </optgroup>
              </select>
            </div>
          </div>

          {!cat ? (
            <div className="kpis">
              <div className="kpi main">
                <span>{plant ? `${plant.short} · ${Math.max(...plant.zones.map((z) => z.radius_m)) / 1000} km zona` : district ? districtName(district) : "Viloyat"} · o‘rtacha · {year}</span>
                <div className="kpi-row">
                  <b>{fmt(curVal)}</b><small>{unit}</small>
                  {calib && curVal != null && (
                    <em className="badge" style={{ background: meta.palette[classIndex(curVal, calib)], color: classIndex(curVal, calib) === 2 ? "#222" : "#fff" }}>
                      {CLASS_LABELS[classIndex(curVal, calib)]}
                    </em>
                  )}
                </div>
              </div>
              <div className="kpi">
                <span>Yillik o‘zgarish</span>
                <b className={tone(delta)}>
                  {delta == null ? "—" : deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${fmt(deltaPct, 1)}%` : `${delta > 0 ? "+" : ""}${fmt(delta)}`}
                </b>
                <small>{year - 1} → {year}{deltaPct == null && unit ? ` · ${unit}` : ""}</small>
              </div>
              <div className="kpi">
                <span>Trend · {YEARS.length} yil</span>
                <b className={tone(slope)}>{slope == null ? "—" : `${slope > 0 ? "+" : ""}${fmt(slope, 3)}`}</b>
                <small>{unit ? `${unit}/yil` : "har yili"} · {mkz == null ? "" : Math.abs(mkz) > 1.96 ? "ahamiyatli" : "ahamiyatsiz"}</small>
              </div>
            </div>
          ) : (
            <LulcBar shares={(district ? stats.data?.districts.find((d) => d.id === district)?.shares : stats.data?.region.shares) ?? null} />
          )}

          {plant && (
            <PlantPanel plant={plant} layer={layer} season={season} year={year} unit={unit} calib={calib} regionMean={stats.data?.region.mean ?? null} onClose={() => setPlantId(null)} />
          )}

          <section className="card">
            <header>
              <span className="eyebrow">Dinamika · {SEASONS[season].label}</span>
              {(regionSeries.loading || districtSeries.loading || plantSeries.loading) && <i className="spin" />}
            </header>
            {regionSeries.error ? <p className="err">{regionSeries.error}</p> :
              chartSeries.some((s) => s.points.length) ? <TrendChart series={chartSeries} years={YEARS} activeYear={year} unit={cat ? "%" : unit} onYear={setYear} /> :
                <div className="skeleton" />}
          </section>

          <section className="card">
            <header>
              <span className="eyebrow">Tumanlar reytingi · {year}</span>
              {stats.loading && <i className="spin" />}
              {cat && (
                <select className="mini" value={lulcClass} onChange={(e) => setLulcClass(Number(e.target.value))}>
                  {LULC_CLASSES.map((c, i) => <option key={c} value={i}>{c}</option>)}
                </select>
              )}
            </header>
            {stats.error && <p className="err">{stats.error}</p>}
            {!stats.data && !stats.error && <div className="skeleton tall" />}
            <ol className="ranking">
              {ranking.map((r, i) => {
                const w = rMax === rMin ? 100 : 6 + (94 * (r.v - rMin)) / (rMax - rMin);
                const color = cat ? LULC_COLORS[lulcClass] : calib ? meta.palette[classIndex(r.v, calib)] : meta.palette[2];
                return (
                  <li key={r.id} className={district === r.id ? "on" : ""} onClick={() => { setPlantId(null); setDistrict(district === r.id ? null : r.id); }}>
                    <span className="rk">{i + 1}</span>
                    <span className="nm">{r.name}</span>
                    <span className="bar"><i style={{ width: `${w}%`, background: color }} /></span>
                    <b>{fmt(r.v)}{cat && "%"}</b>
                  </li>
                );
              })}
            </ol>
            {stats.data && <small className="muted">{cat ? `${LULC_CLASSES[lulcClass]} ulushi, %` : `${unit ? unit + " · " : ""}${meta.higherIsWorse ? "eng yuqori bosim — tepada" : "eng past qiymat — tepada"}`}</small>}
          </section>

          <details className="card science">
            <summary><span className="eyebrow">Metodika va manba</span></summary>
            <p className="note">{meta.note}</p>
            <code>{meta.method}</code>
            <dl>
              <div><dt>Davr</dt><dd>{SEASONS[season].range}.{year}{partial ? " (davom etmoqda)" : ""}</dd></div>
              <div><dt>O‘lchov</dt><dd>{meta.unit}</dd></div>
              <div><dt>Chegaralar</dt><dd>FAO GAUL</dd></div>
            </dl>
            <small>Sinflar 2019–2026 yillar uchun yagona shkalada — yillarni bevosita solishtirish mumkin. Fazoviy moslik sababiy bog‘lanishni isbotlamaydi; natijalar dala kuzatuvlari bilan tekshirilishi lozim.</small>
          </details>

        </aside>
      </div>
    </main>
  );
}

function LegendBox({ legend, unit, mode }: { legend: Legend; unit: string; mode: Mode }) {
  if (legend.kind === "categorical")
    return (
      <div className={`legend ${legend.labels.length > 2 ? "cat" : ""}`}>
        {legend.labels.map((l, i) => <span key={l}><i style={{ background: legend.colors[i] }} />{l}</span>)}
      </div>
    );
  if (legend.kind === "classes")
    return (
      <div className="legend">
        <header>Sinflar {unit && <small>{unit}</small>}</header>
        {legend.labels.map((l, i) => (
          <span key={l}><i style={{ background: legend.colors[i] }} />{l}
            <small>{i === 0 ? `< ${fmt(legend.breaks[0])}` : i === 4 ? `≥ ${fmt(legend.breaks[3])}` : `${fmt(legend.breaks[i - 1])}–${fmt(legend.breaks[i])}`}</small>
          </span>
        ))}
      </div>
    );
  return (
    <div className="legend">
      <header>{mode === "diff" ? "O‘zgarish" : "Qiymat"} {unit && <small>{unit}</small>}</header>
      <div className="ramp" style={{ background: `linear-gradient(90deg, ${legend.colors.join(",")})` }} />
      <div className="ramp-lbl">
        <span>{legend.kind === "diff" ? `−${fmt(Math.abs(legend.min))}` : fmt(legend.min)}</span>
        {legend.kind === "diff" && <span>0</span>}
        <span>{legend.kind === "diff" ? "+" : ""}{fmt(legend.max)}</span>
      </div>
      {mode === "diff" && <small className="muted">Qizil — holat yomonlashgan, ko‘k — yaxshilangan</small>}
    </div>
  );
}

function LulcBar({ shares }: { shares: number[] | null }) {
  if (!shares) return <div className="skeleton" />;
  const items = shares.map((v, i) => ({ v, i })).filter((x) => x.v > 0.3).sort((a, b) => b.v - a.v);
  return (
    <div className="card lulc">
      <div className="stack">{items.map((x) => <i key={x.i} title={`${LULC_CLASSES[x.i]}: ${x.v}%`} style={{ width: `${x.v}%`, background: LULC_COLORS[x.i] }} />)}</div>
      <ul>{items.slice(0, 6).map((x) => <li key={x.i}><i style={{ background: LULC_COLORS[x.i] }} />{LULC_CLASSES[x.i]}<b>{fmt(x.v, 1)}%</b></li>)}</ul>
    </div>
  );
}
