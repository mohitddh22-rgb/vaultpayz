"use client";
import { useState } from "react";
import { LoginGate } from "@/components/SessionProvider";
import { api } from "@/lib/client";

function Gift() {
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [grams, setGrams] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");

  async function go() {
    setBusy(true);
    try {
      const g = await api.gift(metal, grams, message);
      setLink(location.origin + "/gift/" + g.token);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Gift Gold</h1>
      <div className="card" style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["gold", "silver"] as const).map((m) => (
            <button key={m} className={"btn " + (metal === m ? "btn-primary" : "btn-ghost")} onClick={() => setMetal(m)}>
              {m === "gold" ? "Gold" : "Silver"}
            </button>
          ))}
        </div>
        <label className="muted" style={{ fontSize: 13 }}>Grams</label>
        <input className="input" type="number" step="0.0001" value={grams} onChange={(e) => setGrams(Number(e.target.value))} style={{ margin: "8px 0 10px" }} />
        <label className="muted" style={{ fontSize: 13 }}>Message</label>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} style={{ margin: "8px 0 14px" }} />
        <button className="btn btn-primary" disabled={busy} onClick={go}>
          {busy ? "Generating…" : "Create gift link (valid 7 days)"}
        </button>
        {link && (
          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 13 }}>Shareable link:</div>
            <code style={{ display: "block", wordBreak: "break-all", background: "var(--panel-2)", padding: 10, borderRadius: 10, marginTop: 6 }}>{link}</code>
          </div>
        )}
      </div>
    </>
  );
}

export default function GiftPage() {
  return (
    <LoginGate>
      <Gift />
    </LoginGate>
  );
}
