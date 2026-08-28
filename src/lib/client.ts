// Browser-side fetch helpers (standard envelope from v1.0 §5.3)
async function req(url: string, method: string = "GET", body?: any): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Request failed");
  }
  return json.data;
}

export const api = {
  requestOtp: (phone: string, name?: string, email?: string) =>
    req("/api/auth/request-otp", "POST", { phone, name, email }),
  me: () => req("/api/auth/me"),
  prices: () => req("/api/price"),
  summary: () => req("/api/wallet/summary"),
  lookup: (q: string) => req(`/api/users/lookup?q=${encodeURIComponent(q)}`),
  buy: (metal: string, inr: number) => req("/api/payment/buy", "POST", { metal, inr }),
  sell: (metal: string, grams: number) => req("/api/wallet/sell", "POST", { metal, grams }),
  p2p: (to: string, metal: string, grams: number, message?: string) =>
    req("/api/transfer/p2p", "POST", { to, metal, grams, message }),
  gift: (metal: string, grams: number, message?: string) =>
    req("/api/transfer/gift-create", "POST", { metal, grams, message }),
  txns: () => req("/api/transactions"),
  fees: () => req("/api/admin/fees"),
  notifications: () => req("/api/notifications"),
};

export function fmtInr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
export function fmtG(g: number) {
  return g.toFixed(4) + " g";
}
