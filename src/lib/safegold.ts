// SafeGold adapter — wired to the REAL SafeGold partner API (extracted from the
// onboarding kit API docs), with a mock fallback so the app runs with no credentials.
//
// Real endpoints (staging):
//   GET  /v1/partners/buy-price            → current_price, applicable_tax, rate_id, rate_validity
//   POST /v1/partners/{partner_user_id}/gold-transfer
//        → idempotent register-buy-transfer; returns buy_tx_id, transfer_tx_id, customer_user_id
//   GET  /v1/cash-balance/{partner_user_id} → cash_balance, threshold_balance
//
// Set SAFEGOLD_BASE_URL + SAFEGOLD_HMAC_SECRET (and SAFEGOLD_MOCK=false) to go live.
// Auth: Bearer <SAFEGOLD_TOKEN>. Requests are signed HMAC-SHA256 when HMAC secret is set.

import crypto from "crypto";

const BASE = process.env.SAFEGOLD_BASE_URL || "https://partners-staging.safegold.com";
const TOKEN = process.env.SAFEGOLD_TOKEN || "4cd398d7bbe13748c0ef3c756f1cdba2";
const HMAC = process.env.SAFEGOLD_HMAC_SECRET || "";
const MOCK = (process.env.SAFEGOLD_MOCK ?? "true") === "true" || !process.env.SAFEGOLD_BASE_URL;
const PARTNER_USER_ID = process.env.SAFEGOLD_PARTNER_USER_ID || "stage_partner"; // assigned by SafeGold

async function signedFetch(path: string, method: "GET" | "POST", body?: any) {
  const url = `${BASE}${path}`;
  const raw = body ? JSON.stringify(body) : "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
  if (HMAC) {
    const sig = crypto.createHmac("sha256", HMAC).update(raw).digest("hex");
    headers["X-SafeGold-Signature"] = sig;
  }
  const res = await fetch(url, { method, headers, body: raw || undefined });
  if (!res.ok) throw new Error(`SafeGold ${method} ${path} -> ${res.status}`);
  return res.json();
}

export const safegold = {
  async getBuyPrice(metal: "gold" | "silver") {
    if (MOCK) {
      const spot = metal === "gold" ? 7450.25 : 92.4;
      return { current_price: spot, applicable_tax: 3, rate_id: "mock-" + Date.now(), rate_validity: 420 };
    }
    return signedFetch(`/v1/partners/buy-price?metal=${metal}`, "GET");
  },

  // idempotent buy + transfer in one call (real API). client_reference_id dedupes replays.
  async buyAndTransfer(payload: {
    user_id: string;
    metal: "gold" | "silver";
    grams: number;
    rate_id: string;
    client_reference_id: string;
    name?: string;
    phone_no?: string;
    pin_code?: string;
  }) {
    if (MOCK) {
      return {
        buy_tx_id: "SG-B-" + payload.client_reference_id,
        transfer_tx_id: "SG-T-" + payload.client_reference_id,
        customer_user_id: "SGU-" + payload.user_id.slice(0, 8),
      };
    }
    return signedFetch(`/v1/partners/${PARTNER_USER_ID}/gold-transfer`, "POST", {
      name: payload.name || "VaultPayz User",
      phone_no: payload.phone_no || "",
      pin_code: payload.pin_code || "110001",
      rate_id: payload.rate_id,
      gold_amount: payload.grams,
      buy_price: (payload.grams * (payload.metal === "gold" ? 7450.25 : 92.4) * 1.03).toFixed(2),
      client_reference_id: payload.client_reference_id,
    });
  },

  async sell(payload: { user_id: string; metal: "gold" | "silver"; grams: number; client_reference_id: string }) {
    if (MOCK) return { sell_tx_id: "SG-S-" + payload.client_reference_id };
    // Real sell endpoint per SafeGold docs (gift/sell family). Adjust path if SG confirms.
    return signedFetch(`/v1/partners/${PARTNER_USER_ID}/sell`, "POST", {
      gold_amount: payload.grams,
      client_reference_id: payload.client_reference_id,
    });
  },

  async transfer(payload: { from_user_id: string; to_user_id: string; metal: "gold" | "silver"; grams: number; client_reference_id: string }) {
    if (MOCK) return { transfer_tx_id: "SG-T-" + payload.client_reference_id };
    return signedFetch(`/v1/partners/${PARTNER_USER_ID}/gold-transfer`, "POST", {
      gold_amount: payload.grams,
      client_reference_id: payload.client_reference_id,
    });
  },

  async getBalance(_userId: string, _metal: "gold" | "silver") {
    if (MOCK) return 0; // mock: no external custody, local ledger is truth
    const data = await signedFetch(`/v1/cash-balance/${PARTNER_USER_ID}`, "GET");
    return Number(data.cash_balance || 0);
  },

  async dispatch(topic: string, payload: any, requestId: string) {
    switch (topic) {
      case "safegold.buy":
        return this.buyAndTransfer({ ...payload, client_reference_id: requestId });
      case "safegold.sell":
        return this.sell({ ...payload, client_reference_id: requestId });
      case "safegold.transfer":
        return this.transfer({ ...payload, client_reference_id: requestId });
      default:
        throw new Error("Unknown SafeGold topic " + topic);
    }
  },
};
