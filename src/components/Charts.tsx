"use client";

import React from "react";

// Tiny deterministic pseudo-random walk for demo charts (no deps).
function walk(n: number, seed: number, vol: number) {
  let v = 100;
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.5;
    v = Math.max(20, v + r * vol);
    out.push(v);
  }
  return out;
}

export function Sparkline({ seed = 7, color = "#c9a227", up = true }: { seed?: number; color?: string; up?: boolean }) {
  const data = walk(24, seed, 8);
  const w = 120, h = 36, pad = 3;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w - pad} ${h - pad} L${pad} ${h - pad} Z`;
  const stroke = up ? color : "var(--err)";
  const gid = "sp" + seed;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function PriceChart({ metal = "gold" }: { metal?: "gold" | "silver" }) {
  const [tf, setTf] = React.useState("1M");
  const tfs = ["1D", "1W", "1M", "1Y", "ALL"];
  const n = tf === "1D" ? 24 : tf === "1W" ? 28 : tf === "1M" ? 30 : tf === "1Y" ? 52 : 60;
  const vol = metal === "gold" ? 4 : 6;
  const data = walk(n, metal === "gold" ? 11 : 23, vol);
  const up = data[n - 1] >= data[0];
  const w = 720, h = 240, pad = 8;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w - pad} ${h - pad} L${pad} ${h - pad} Z`;
  const stroke = up ? "var(--gold)" : "var(--err)";
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {tfs.map((t) => (
          <button key={t} onClick={() => setTf(t)} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13, background: t === tf ? "var(--gold-soft)" : "var(--surface-2)", color: t === tf ? "#8a6d0c" : "var(--muted)" }}>
            {t}
          </button>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="#eef0f4" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#pc)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
