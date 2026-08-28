"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { useSession } from "./SessionProvider";

const nav = [
  { href: "/", label: "Dashboard", icon: Icon.grid },
  { href: "/buy", label: "Buy", icon: Icon.buy },
  { href: "/sell", label: "Sell", icon: Icon.sell },
  { href: "/transfer", label: "Transfer", icon: Icon.send },
  { href: "/gift", label: "Gift", icon: Icon.gift },
  { href: "/transactions", label: "History", icon: Icon.list },
  { href: "/admin", label: "Admin", icon: Icon.shield },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me } = useSession();

  const gold = me ? (me.wallets.find((w: any) => w.metal_type === "gold")?.balance_grams || 0) : 0;
  const silver = me ? (me.wallets.find((w: any) => w.metal_type === "silver")?.balance_grams || 0) : 0;
  const goldInr = me ? (me.wallets.find((w: any) => w.metal_type === "gold")?.balance_grams || 0) * (me.wallets.find((w: any) => w.metal_type === "gold")?.last_price_inr || 0) : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 12px" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,var(--gold),var(--gold-2))", display: "grid", placeItems: "center", color: "#1a1404", fontWeight: 900 }}>V</span>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>VaultPayz</span>
        </div>

        <div className="card" style={{ padding: 16, background: "linear-gradient(135deg,#fffdf4,#fbf6e3)", borderColor: "#efe2b8" }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>TOTAL HOLDINGS</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }} className="tabnums">₹{Math.round(goldInr).toLocaleString("en-IN")}</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>{gold.toFixed(2)}g</span> gold · {silver.toFixed(1)}g silver
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
          {nav.map((n) => {
            const active = path === n.href;
            const I = n.icon;
            return (
              <Link key={n.href} href={n.href} className={"navlink" + (active ? " active" : "")}>
                <I size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", fontSize: 11, color: "var(--muted)", padding: "8px 8px 0" }}>
          VaultPayz v1.1 · demo
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <span style={{ position: "absolute", left: 12, top: 9, color: "var(--muted)" }}><Icon.search size={16} /></span>
            <input className="input" placeholder="Search VaultID, phone…" style={{ paddingLeft: 36 }} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ position: "relative", color: "var(--muted)" }}>
              <Icon.bell size={20} />
              <span style={{ position: "absolute", top: -4, right: -4, background: "var(--err)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "0 5px", border: "2px solid var(--bg)" }}>5</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--navy)", color: "#fff", display: "grid", placeItems: "center" }}>
                <Icon.user size={17} />
              </span>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{me?.profile.full_name || "Guest"}</div>
                <div style={{ fontSize: 11 }} className="muted">{me?.profile.vault_id || "—"}</div>
              </div>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
