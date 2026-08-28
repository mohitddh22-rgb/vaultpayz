"use client";
import { useEffect, useState } from "react";
import { LoginGate, useSession } from "@/components/SessionProvider";
import { api, fmtInr, fmtG } from "@/lib/client";

function Dash() {
  const { me } = useSession();
  const [prices, setPrices] = useState<any>(null);
  const [sum, setSum] = useState<any>(null);

  useEffect(() => {
    api.prices().then(setPrices).catch(() => {});
    api.summary().then(setSum).catch(() => {});
  }, []);

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Welcome, {me?.profile.full_name || "Investor"}</h1>
      <p className="muted" style={{ fontSize: 14 }}>
        VaultID {me?.profile.vault_id} · KYC: <span className="tag tag-warn">{me?.profile.kyc_status}</span>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {["gold", "silver"].map((m) => {
          const w = sum?.[m];
          const inr = m === "gold" ? sum?.gold_inr : sum?.silver_inr;
          return (
            <div className="card" key={m}>
              <div style={{ textTransform: "capitalize", fontWeight: 700, color: m === "gold" ? "var(--gold)" : "var(--muted)" }}>
                {m}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{fmtG(w?.balance_grams || 0)}</div>
              <div className="muted" style={{ fontSize: 13 }}>≈ {fmtInr(inr || 0)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                @ {fmtInr((w?.last_price_inr || 0))}/g
              </div>
            </div>
          );
        })}
      </div>

      {prices && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Live SafeGold price (mock)</div>
          <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
            <span>Gold buy {fmtInr(prices.find((p: any) => p.metal_type === "gold")?.buy_price_per_gram)}/g</span>
            <span>Silver buy {fmtInr(prices.find((p: any) => p.metal_type === "silver")?.buy_price_per_gram)}/g</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <a className="btn btn-primary" href="/buy">Buy</a>
        <a className="btn btn-ghost" href="/sell">Sell</a>
        <a className="btn btn-ghost" href="/transfer">P2P Transfer</a>
        <a className="btn btn-ghost" href="/gift">Gift</a>
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
