"use client";
import { useState } from "react";
import { LoginGate } from "@/components/SessionProvider";
import { api, fmtInr } from "@/lib/client";

function Transfer() {
  const [to, setTo] = useState("");
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [grams, setGrams] = useState(1);
  const [message, setMessage] = useState("");
  const [found, setFound] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const FEE = 0.0033;
  const feeG = grams * FEE;
  const netG = grams - feeG;

  async function lookup() {
    if (!to) return;
    const r = await api.lookup(to);
    setFound(r);
  }
  async function go() {
    setBusy(true);
    setMsg("");
    try {
      const t = await api.p2p(to, metal, grams, message);
      setMsg(`Sent ${t.amount_grams}g ${metal} to ${found?.name || to}. Transfer ${t.transfer_id}`);
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>P2P Transfer</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <label className="muted" style={{ fontSize: 13 }}>Recipient (VaultID / phone / email)</label>
        <div style={{ display: "flex", gap: 8, margin: "8px 0 10px" }}>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="VP123456 / 98765…" />
          <button className="btn btn-ghost" onClick={lookup}>Lookup</button>
        </div>
        {found?.found && (
          <div className="tag tag-ok" style={{ marginBottom: 10 }}>
            {found.name} · {found.phone_masked}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["gold", "silver"] as const).map((m) => (
            <button key={m} className={"btn " + (metal === m ? "btn-primary" : "btn-ghost")} onClick={() => setMetal(m)}>
              {m === "gold" ? "Gold" : "Silver"}
            </button>
          ))}
        </div>

        <label className="muted" style={{ fontSize: 13 }}>Grams</label>
        <input className="input" type="number" step="0.0001" value={grams} onChange={(e) => setGrams(Number(e.target.value))} style={{ margin: "8px 0 6px" }} />

        <label className="muted" style={{ fontSize: 13 }}>Message (optional)</label>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} style={{ margin: "8px 0 12px" }} />

        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Fee (0.33%): {feeG.toFixed(6)}g · Receiver gets: <b style={{ color: "var(--gold)" }}>{netG.toFixed(6)}g</b>
        </div>

        <button className="btn btn-primary" disabled={busy || !found?.found} onClick={go}>
          {busy ? "Transferring…" : "Send (double-confirm)"}
        </button>
        {msg && <p style={{ fontSize: 14, marginTop: 12, color: msg.startsWith("Error") ? "var(--err)" : "var(--ok)" }}>{msg}</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Atomic DB txn (SELECT FOR UPDATE) → ledger debit+credit → fee to accumulator → SafeGold transfer async (idempotent).
        </p>
      </div>
    </>
  );
}

export default function TransferPage() {
  return (
    <LoginGate>
      <Transfer />
    </LoginGate>
  );
}
