"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { useSession } from "./SessionProvider";
import { api } from "@/lib/client";

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
  const { me, logout } = useSession();

  const gold = me ? (me.wallets.find((w: any) => w.metal_type === "gold")?.balance_grams || 0) : 0;
  const silver = me ? (me.wallets.find((w: any) => w.metal_type === "silver")?.balance_grams || 0) : 0;
  const goldInr = me ? gold * (me.wallets.find((w: any) => w.metal_type === "gold")?.last_price_inr || 0) : 0;

  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (me) api.notifications().then((d) => setNotifs(d.notifications || [])).catch(() => {});
  }, [me]);

  // close dropdowns on outside click / escape
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profRef.current && !profRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = notifs.filter((n) => !n.is_read).length;

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
              <Link key={n.href} href={n.href} className={"navlink" + (active ? " active" : "")} onClick={() => { setNotifOpen(false); setProfileOpen(false); }}>
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
            {/* Notifications */}
            <div style={{ position: "relative" }} ref={notifRef}>
              <button className="btn btn-ghost" style={{ padding: 8, borderRadius: 10, background: "var(--surface-2)" }} onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }} aria-label="Notifications">
                <Icon.bell size={20} />
                {unread > 0 && (
                  <span style={{ position: "absolute", top: 2, right: 2, background: "var(--err)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "0 5px", border: "2px solid var(--bg)" }}>{unread}</span>
                )}
              </button>
              {notifOpen && (
                <div className="card" style={{ position: "absolute", right: 0, top: 46, width: 320, zIndex: 30, padding: 8, boxShadow: "0 8px 30px rgba(17,24,39,0.12)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 8px" }}>
                    <b style={{ fontSize: 14 }}>Notifications</b>
                    {unread > 0 && <span className="tag tag-warn">{unread} new</span>}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {notifs.length === 0 && <div className="muted" style={{ fontSize: 13, padding: 12, textAlign: "center" }}>No notifications</div>}
                    {notifs.map((n) => (
                      <div key={n.id} style={{ padding: "10px 8px", borderTop: "1px solid var(--border)", background: n.is_read ? "transparent" : "var(--gold-soft)" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div style={{ position: "relative" }} ref={profRef}>
              <button onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--navy)", color: "#fff", display: "grid", placeItems: "center" }}>
                  <Icon.user size={17} />
                </span>
                <div style={{ lineHeight: 1.1, textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{me?.profile.full_name || "Guest"}</div>
                  <div style={{ fontSize: 11 }} className="muted">{me?.profile.vault_id || "—"}</div>
                </div>
              </button>
              {profileOpen && (
                <div className="card" style={{ position: "absolute", right: 0, top: 46, width: 240, zIndex: 30, padding: 14, boxShadow: "0 8px 30px rgba(17,24,39,0.12)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{me?.profile.full_name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{me?.profile.email || me?.profile.phone}</div>
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div className="muted">VaultID</div>
                    <div className="tabnums" style={{ fontWeight: 600 }}>{me?.profile.vault_id}</div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <div className="muted">KYC status</div>
                    <span className="tag tag-warn" style={{ marginTop: 2 }}>{me?.profile.kyc_status}</span>
                  </div>
                  <button className="btn btn-ghost" style={{ width: "100%", marginTop: 14 }} onClick={() => { setProfileOpen(false); logout(); }}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
