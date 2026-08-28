"use client";
import { useState } from "react";
import { LoginGate, useSession } from "@/components/SessionProvider";
import { api, fmtInr } from "@/lib/client";

function Sell() {
  const { me } = useSession();
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [grams, setGrams] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function go() {
    setBusy(true);
    setMsg("");
    try {
      const txn = await api.sell(metal, grams);
      setMsg(`Sold ${txn.amount_grams}g ${metal} for ${fmtInr(txn.amount_inr)}. Tax ID ${txn.tax_id}`);
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Sell {metal}</h1>
      <div className="card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["gold", "silver"] as const).map((m) => (
            <button key={m} className={"btn " + (metal === m ? "btn-primary" : "btn-ghost")} onClick={() => setMetal(m)}>
              {m === "gold" ? "Gold" : "Silver"}
            </button>
          ))}
        </div>
        <label className="muted" style={{ fontSize: 13 }}>Grams to sell</label>
        <input className="input" type="number" step="0.0001" value={grams} onChange={(e) => setGrams(Number(e.target.value))} style={{ margin: "8px 0 14px" }} />
        <button className="btn btn-primary" disabled={busy} onClick={go}>
          {busy ? "Processing…" : `Sell ${grams}g`}
        </button>
        {msg && <p style={{ fontSize: 14, marginTop: 12, color: msg.startsWith("Error") ? "var(--err)" : "var(--ok)" }}>{msg}</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Atomic ledger debit + SafeGold sell via outbox. TDS 1% auto-deducted if sale &gt; ₹10,000 (v1.0 §16.2).
        </p>
      </div>
    </>
  );
}

export default function SellPage() {
  return (
    <LoginGate>
      <Sell />
    </LoginGate>
  );
}
