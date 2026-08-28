"use client";
import { useEffect, useState } from "react";
import { LoginGate } from "@/components/SessionProvider";
import { api } from "@/lib/client";

function History() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.txns().then(setData).catch(() => {});
  }, []);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Transaction History</h1>
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr className="muted" style={{ textAlign: "left" }}>
              <th style={th}>Tax ID</th>
              <th style={th}>Type</th>
              <th style={th}>Metal</th>
              <th style={th}>Grams</th>
              <th style={th}>₹</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((t: any) => (
              <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={td}>{t.tax_id}</td>
                <td style={td}>{t.txn_type}</td>
                <td style={td}>{t.metal_type}</td>
                <td style={td}>{t.amount_grams}</td>
                <td style={td}>{t.amount_inr}</td>
                <td style={td}><span className="tag tag-ok">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Ledger is the single source of truth — balances are materialized from wallet_ledger only (addendum v1.1 §B).
      </p>
    </>
  );
}
const th: React.CSSProperties = { padding: "8px 6px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 6px" };

export default function HistoryPage() {
  return (
    <LoginGate>
      <History />
    </LoginGate>
  );
}
