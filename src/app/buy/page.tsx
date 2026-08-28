"use client";
import { useState } from "react";
import { LoginGate, useSession } from "@/components/SessionProvider";
import { api, fmtInr } from "@/lib/client";

function Buy() {
  const { me } = useSession();
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [inr, setInr] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function go() {
    setBusy(true);
    setMsg("");
    try {
      const txn = await api.buy(metal, inr);
      setMsg(`Bought ${txn.amount_grams}g ${metal}. Tax ID ${txn.tax_id}`);
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Buy {metal}</h1>
      <div className="card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["gold", "silver"] as const).map((m) => (
            <button key={m} className={"btn " + (metal === m ? "btn-primary" : "btn-ghost")} onClick={() => setMetal(m)}>
              {m === "gold" ? "Gold" : "Silver"}
            </button>
          ))}
        </div>
        <label className="muted" style={{ fontSize: 13 }}>Amount in ₹</label>
        <input className="input" type="number" value={inr} onChange={(e) => setInr(Number(e.target.value))} style={{ margin: "8px 0 14px" }} />
        <button className="btn btn-primary" disabled={busy} onClick={go}>
          {busy ? "Processing…" : `Buy for ${fmtInr(inr)}`}
        </button>
        {msg && <p style={{ fontSize: 14, marginTop: 12, color: msg.startsWith("Error") ? "var(--err)" : "var(--ok)" }}>{msg}</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Flow: price-lock → Razorpay (mock) → outbox → SafeGold buy (idempotent) → ledger credited → fee accrued.
        </p>
      </div>
    </>
  );
}

export default function BuyPage() {
  return (
    <LoginGate>
      <Buy />
    </LoginGate>
  );
}
