"use client";
import { useEffect, useState } from "react";
import { LoginGate } from "@/components/SessionProvider";
import { api } from "@/lib/client";

function Admin() {
  const [fees, setFees] = useState<any>(null);
  useEffect(() => {
    api.fees().then(setFees).catch(() => {});
  }, []);
  if (!fees) return <p className="muted">Loading…</p>;
  const acc = fees.fee_accumulator;
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Admin Console <span className="tag tag-warn">demo</span></h1>
      <p className="muted" style={{ fontSize: 13 }}>Users: {fees.users} · P2P transfers logged: {fees.transfers.length}</p>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Fee Accumulator (revenue engine)</h3>
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr className="muted" style={{ textAlign: "left" }}>
              <th style={th}>Type</th>
              <th style={th}>Total ₹</th>
              <th style={th}>Today ₹</th>
              <th style={th}>Grams</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(acc).map(([k, v]: any) => (
              <tr key={k} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={td}>{k}</td>
                <td style={td}>₹{v.total_inr.toLocaleString("en-IN")}</td>
                <td style={td}>₹{v.today_inr.toLocaleString("en-IN")}</td>
                <td style={td}>{v.total_grams}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Real admin panel: KYC queue, user mgmt, transaction monitor, reconciliation (addendum §E), audit log, 2FA+IP whitelist.
      </p>
    </>
  );
}
const th: React.CSSProperties = { padding: "8px 6px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 6px" };

export default function AdminPage() {
  return (
    <LoginGate>
      <Admin />
    </LoginGate>
  );
}
