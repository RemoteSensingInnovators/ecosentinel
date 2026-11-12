"use client";

import { useState } from "react";
import { fmt } from "@/lib/layers";

export interface Series {
  label: string;
  color: string;
  points: { year: number; value: number | null }[];
  dashed?: boolean;
}

/** Sen's slope — tashqi qiymatlarga chidamli trend bahosi (birlik/yil) */
export function senSlope(pts: { year: number; value: number | null }[]): number | null {
  const v = pts.filter((p) => p.value != null) as { year: number; value: number }[];
  const s: number[] = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) s.push((v[j].value - v[i].value) / (v[j].year - v[i].year));
  if (s.length < 3) return null;
  s.sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mann–Kendall testining Z statistikasi (|Z| > 1.96 → p < 0.05) */
export function mannKendallZ(pts: { year: number; value: number | null }[]): number | null {
  const v = pts.filter((p) => p.value != null).map((p) => p.value as number);
  const n = v.length;
  if (n < 4) return null;
  let S = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(v[j] - v[i]);
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  return S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
}

export default function TrendChart({ series, years, activeYear, unit, onYear }: {
  series: Series[];
  years: readonly number[];
  activeYear: number;
  unit: string;
  onYear?: (y: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = 170, P = { l: 44, r: 10, t: 12, b: 24 };
  const vals = series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v != null && Number.isFinite(v));
  if (!vals.length) return <div className="chart-empty">Ma’lumot yo‘q</div>;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const x = (y: number) => P.l + ((y - years[0]) / (years[years.length - 1] - years[0])) * (W - P.l - P.r);
  const yv = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);
  const hy = hover ?? activeYear;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yillar bo‘yicha dinamika" onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={yv(t)} y2={yv(t)} className="grid" />
            <text x={P.l - 6} y={yv(t) + 3} className="tick" textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {years.map((y) => (
          <text key={y} x={x(y)} y={H - 6} className={`tick ${y === activeYear ? "on" : ""}`} textAnchor="middle">{String(y).slice(2)}</text>
        ))}
        <line x1={x(hy)} x2={x(hy)} y1={P.t} y2={H - P.b} className="cursor" />
        {series.map((s) => {
          const pts = s.points.filter((p) => p.value != null) as { year: number; value: number }[];
          const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${yv(p.value).toFixed(1)}`).join("");
          const slope = senSlope(s.points);
          const med = pts.length ? pts.map((p) => p.value).sort((a, b) => a - b)[pts.length >> 1] : 0;
          const ym = years[(years.length - 1) >> 1] + 0.5;
          return (
            <g key={s.label}>
              {slope != null && (
                <line x1={x(years[0])} x2={x(years[years.length - 1])}
                  y1={yv(med + slope * (years[0] - ym))} y2={yv(med + slope * (years[years.length - 1] - ym))}
                  stroke={s.color} strokeOpacity={0.35} strokeDasharray="4 4" strokeWidth={1.2} />
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 3" : undefined} />
              {pts.map((p) => (
                <circle key={p.year} cx={x(p.year)} cy={yv(p.value)} r={p.year === hy ? 4.5 : 2.6} fill={p.year === hy ? s.color : "var(--bg-1)"} stroke={s.color} strokeWidth={1.6} />
              ))}
            </g>
          );
        })}
        {years.map((y, i) => {
          const w = (W - P.l - P.r) / (years.length - 1);
          return (
            <rect key={y} x={x(y) - w / 2} y={P.t} width={w} height={H - P.t - P.b} fill="transparent"
              style={{ cursor: onYear ? "pointer" : undefined }}
              onMouseEnter={() => setHover(y)} onClick={() => onYear?.(y)} data-i={i} />
          );
        })}
      </svg>
      <div className="chart-readout">
        <span>{hy}</span>
        {series.map((s) => {
          const v = s.points.find((p) => p.year === hy)?.value;
          return <b key={s.label} style={{ color: s.color }}>{s.label}: {fmt(v)} <small>{unit}</small></b>;
        })}
      </div>
    </div>
  );
}
