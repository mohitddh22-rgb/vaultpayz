"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Me {
  profile: { id: string; vault_id: string; full_name: string | null; phone: string; kyc_status: string };
  wallets: { user_id: string; metal_type: string; balance_grams: number; locked_grams: number; last_price_inr: number }[];
}
const Ctx = createContext<{ me: Me | null; login: (phone: string, name?: string) => Promise<void>; loading: boolean }>({
  me: null,
  login: async () => {},
  loading: true,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(phone: string, name?: string) {
    const r = await api.requestOtp(phone, name);
    const me = await api.me();
    setMe(me);
  }

  return <Ctx.Provider value={{ me, login, loading }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { me, login, loading } = useSession();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="muted">Loading…</div>;
  if (me) return <>{children}</>;
  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>Sign in to VaultPayz</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Demo mode: enter any phone + name to get an OTP-less session. Mock SafeGold/Razorpay.
      </p>
      <input className="input" placeholder="Phone (10 digits)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ marginBottom: 10 }} />
      <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
      <button
        className="btn btn-primary"
        disabled={busy || phone.length < 10}
        onClick={async () => {
          setBusy(true);
          try {
            await login(phone, name);
          } catch (e: any) {
            alert(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing in…" : "Get OTP & Continue"}
      </button>
    </div>
  );
}
