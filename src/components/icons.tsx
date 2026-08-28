// Minimal inline SVG icons (stroke = currentColor) so no icon dep is needed.
import React from "react";

type P = { size?: number; className?: string };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Icon = {
  grid: (p: P) => (
    <svg {...base(p.size)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  wallet: (p: P) => (
    <svg {...base(p.size)}><path d="M3 7a2 2 0 0 1 2-2h12v3" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" /><path d="M21 14h-5a2 2 0 0 1 0-4h5" /></svg>
  ),
  buy: (p: P) => (
    <svg {...base(p.size)}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  ),
  sell: (p: P) => (
    <svg {...base(p.size)}><path d="M5 12h14" /></svg>
  ),
  send: (p: P) => (
    <svg {...base(p.size)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
  ),
  gift: (p: P) => (
    <svg {...base(p.size)}><path d="M20 12v9H4v-9" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7S10 2 7.5 4.5 9 7 12 7Zm0 0s2-5 4.5-2.5S15 7 12 7Z" /></svg>
  ),
  list: (p: P) => (
    <svg {...base(p.size)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
  ),
  shield: (p: P) => (
    <svg {...base(p.size)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
  ),
  search: (p: P) => (
    <svg {...base(p.size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  bell: (p: P) => (
    <svg {...base(p.size)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  ),
  user: (p: P) => (
    <svg {...base(p.size)}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  gold: (p: P) => (
    <svg {...base(p.size)}><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M6 8V6h12v2M6 16v2h12v-2" /></svg>
  ),
};
