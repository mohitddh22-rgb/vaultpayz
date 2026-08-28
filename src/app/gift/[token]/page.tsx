"use client";
import { useEffect, useState } from "react";

export default function GiftClaim({ params }: { params: { token: string } }) {
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/transfer/gift-claim/${params.token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setState("ok");
          setInfo(j.data);
        } else {
          setState("err");
        }
      })
      .catch(() => setState("err"));
  }, [params.token]);

  return (
    <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>Gold Gift</h2>
      {state === "loading" && <p className="muted">Checking…</p>}
      {state === "ok" && (
        <>
          <p>You've received <b style={{ color: "var(--gold-light)" }}>{info.amount_grams}g {info.metal_type}</b>!</p>
          <p className="muted" style={{ fontSize: 13 }}>Sign in to VaultPayz to claim it into your vault.</p>
          <a className="btn btn-primary" href="/">Claim & continue</a>
        </>
      )}
      {state === "err" && <p style={{ color: "var(--err)" }}>This gift link is invalid or expired.</p>}
    </div>
  );
}
