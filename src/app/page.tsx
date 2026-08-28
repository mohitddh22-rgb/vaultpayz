"use client";
import { useEffect, useState } from "react";
import { LoginGate, useSession } from "@/components/SessionProvider";
import { Shell } from "@/components/Shell";
import { Sparkline, PriceChart } from "@/components/Charts";
import { Icon } from "@/components/icons";
import { api, fmtInr, fmtG } from "@/lib/client";

function Dash() {
  const { me } = useSession();
  const [prices, setPrices] = useState<any>(null);
  const [sum, setSum] = useState<any>(null);
  const [txns, setTxns] = useState<any>([]);

  useEffect(() => {
    api.prices().then(setPrices).catch(() => {});
    api.summary().then(setSum).catch(() => {});
    api.txns().then((d) => setTxns(d.transactions || [])).catch(() => {});
  }, []);

  const gold = sum?.gold;
  const silver = sum?.silver;
  const assets = [
    { metal: "gold", label: "Gold", grams: gold?.balance_grams || 0, inr: sum?.gold_inr || 0, price: prices?.find((p: any) => p.metal_type === "gold")?.buy_price_per_gram || 0, seed: 11, up: true },
    { metal: "silver", label: "Silver", grams: silver?.balance_grams || 0, inr: sum?.silver_inr || 0, price: prices?.find((p: any) => p.metal_type === "silver")?.buy_price_per_gram || 0, seed: 23, up: false },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>My Portfolio</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>VaultID {me?.profile.vault_id} · <span className="tag tag-warn">{me?.profile.kyc_status}</span></p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a className="btn btn-primary" href="/buy"><Icon.buy size={16} /> Buy</a>
          <a className="btn btn-dark" href="/transfer"><Icon.send size={16} /> Transfer</a>
        </div>
      </div>

      {/* portfolio asset cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        {assets.map((a) => (
          <div key={a.metal} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{a.label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }} className="tabnums">{fmtG(a.grams)}</div>
                <div className="muted" style={{ fontSize: 12 }}>≈ {fmtInr(a.inr)}</div>
              </div>
              <Sparkline seed={a.seed} up={a.up} />
            </div>
            <div style={{ fontSize: 13, marginTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Live buy</span>
              <span className="tabnums" style={{ fontWeight: 700 }}>{fmtInr(a.price)}/g</span>
            </div>
          </div>
        ))}
      </div>

      {/* chart + watchlist/transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Gold Price</h3>
            <span className="pos" style={{ fontSize: 13, fontWeight: 700 }}>▲ live</span>
          </div>
          <PriceChart metal="gold" />
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 10px" }}>Recent Activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
            {txns.slice(0, 8).map((t: any) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{t.txn_type.replace("_", " ")}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{t.tax_id}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="tabnums" style={{ fontSize: 14, fontWeight: 700 }}>{fmtG(t.amount_grams)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{fmtInr(t.amount_inr)}</div>
                </div>
              </div>
            ))}
            {!txns.length && <p className="muted" style={{ fontSize: 13 }}>No activity yet.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <LoginGate>
      <Dash />
    </LoginGate>
  );
}
