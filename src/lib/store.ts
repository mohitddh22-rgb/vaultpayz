// In-memory repository implementing the addendum v1.1 architecture:
//  - wallet_ledger is the SINGLE SOURCE OF TRUTH (ledger-as-truth)
//  - money flows write ledger + outbox atomically, then a relay calls SafeGold idempotently
//  - idempotency via request_id on every external call
//  - compensation saga reverses ledger entries on downstream failure
//
// This runs with MODE=mock (zero external services). For MODE=supabase the same logic
// lives in SQL triggers/functions (see supabase/migrations/).

import type {
  Profile,
  WalletBalance,
  Price,
  Transaction,
  P2PTransfer,
  GiftLink,
} from "./types";
import { safegold } from "./safegold";
import { FEES } from "./fees";

const SPREAD = FEES.spreadRate; // 1.5%
const P2P_FEE = FEES.p2pFeeRate; // 0.33%

// ── module singleton (survives requests in dev) ───────────────────────────
interface DB {
  profiles: Map<string, Profile>;
  wallets: Map<string, WalletBalance>; // key `${user_id}:${metal}`
  ledger: any[];
  transactions: Transaction[];
  transfers: P2PTransfer[];
  gifts: GiftLink[];
  paymentOrders: any[];
  outbox: any[];
  safegoldOrders: any[];
  feeLedger: any[];
  feeAccum: Record<string, { total_inr: number; total_grams: number; today_inr: number }>;
  notifications: any[];
  prices: Record<string, Price>;
}

const g = globalThis as any;
if (!g.__vp_db) {
  g.__vp_db = {
    profiles: new Map(),
    wallets: new Map(),
    ledger: [],
    transactions: [],
    transfers: [],
    gifts: [],
    paymentOrders: [],
    outbox: [],
    safegoldOrders: [],
    feeLedger: [],
    feeAccum: {
      spread: { total_inr: 0, total_grams: 0, today_inr: 0 },
      p2p_fee: { total_inr: 0, total_grams: 0, today_inr: 0 },
      sg_commission: { total_inr: 0, total_grams: 0, today_inr: 0 },
      amc: { total_inr: 0, total_grams: 0, today_inr: 0 },
      delivery: { total_inr: 0, total_grams: 0, today_inr: 0 },
    },
    notifications: [],
    prices: {},
  } as DB;
}
const db: DB = g.__vp_db;

// seed demo prices (mirrors SafeGold spot)
const now = () => new Date().toISOString();
db.prices.gold = {
  metal_type: "gold",
  spot_price_per_gram: 7450.25,
  buy_price_per_gram: round2(7450.25 * (1 + SPREAD) + 7450.25 * 0.03),
  sell_price_per_gram: round2(7450.25 * (1 - SPREAD)),
  fetched_at: now(),
};
db.prices.silver = {
  metal_type: "silver",
  spot_price_per_gram: 92.4,
  buy_price_per_gram: round2(92.4 * (1 + SPREAD) + 92.4 * 0.03),
  sell_price_per_gram: round2(92.4 * (1 - SPREAD)),
  fetched_at: now(),
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function rid() {
  return uid().replace(/-/g, "") + Date.now().toString(36);
}

// ── ledger (single source of truth) ───────────────────────────────────────
function ledgerKey(userId: string, metal: string) {
  return `${userId}:${metal}`;
}
function getWallet(userId: string, metal: "gold" | "silver"): WalletBalance {
  const k = ledgerKey(userId, metal);
  let w = db.wallets.get(k);
  if (!w) {
    w = {
      user_id: userId,
      metal_type: metal,
      balance_grams: 0,
      locked_grams: 0,
      last_price_inr: db.prices[metal].buy_price_per_gram,
    };
    db.wallets.set(k, w);
  }
  return w;
}
function runningBalance(userId: string, metal: string) {
  return db.ledger
    .filter((l) => l.user_id === userId && l.metal_type === metal)
    .reduce((acc, l) => acc + (l.entry_type === "credit" ? l.amount_grams : -l.amount_grams), 0);
}
// the ONLY writer of balance — mirrors the apply_ledger_to_wallet trigger
function postLedger(entries: any[]) {
  for (const e of entries) {
    const row = {
      id: uid(),
      user_id: e.user_id,
      metal_type: e.metal_type,
      entry_type: e.entry_type,
      amount_grams: e.amount_grams,
      balance_after_grams: round6(runningBalance(e.user_id, e.metal_type) + (e.entry_type === "credit" ? e.amount_grams : -e.amount_grams)),
      txn_ref: e.txn_ref,
      request_id: e.request_id,
      note: e.note,
      created_at: now(),
    };
    db.ledger.push(row);
    const w = getWallet(e.user_id, e.metal_type);
    if (e.note !== "system") {
      w.balance_grams = round6(w.balance_grams + (e.entry_type === "credit" ? e.amount_grams : -e.amount_grams));
    }
  }
}

function notify(userId: string, title: string, body: string) {
  db.notifications.push({ id: uid(), user_id: userId, title, body, is_read: false, created_at: now() });
}

// ── outbox relay (saga) ───────────────────────────────────────────────────
// Drains pending outbox rows, calls SafeGold idempotently, compensates on failure.
let draining = false;
async function drainOutbox() {
  if (draining) return;
  draining = true;
  try {
    for (const job of db.outbox.filter((j) => j.status === "pending")) {
      try {
        const res = await safegold.dispatch(job.topic, job.payload, job.request_id);
        job.status = "done";
        job.done_at = now();
        job.result = res;
      } catch (err: any) {
        job.attempts = (job.attempts || 0) + 1;
        if (job.attempts >= 5) {
          job.status = "dead";
          // compensation saga: reverse the ledger entries for this request_id
          compensate(job.request_id);
        }
      }
    }
  } finally {
    draining = false;
  }
}
function compensate(requestId: string) {
  const rows = db.ledger.filter((l) => l.request_id === requestId);
  if (!rows.length) return;
  const reversal = rows.map((r) => ({
    user_id: r.user_id,
    metal_type: r.metal_type,
    entry_type: r.entry_type === "credit" ? "debit" : "credit",
    amount_grams: r.amount_grams,
    txn_ref: r.txn_ref,
    request_id: rid(),
    note: "reversed",
  }));
  postLedger(reversal);
  const txn = db.transactions.find((t) => t.id === rows[0].txn_ref);
  if (txn) txn.status = "reversed";
  notify(rows[0].user_id, "Transaction reversed", "A backend error reversed your transaction. No funds moved.");
}

// ── public repo API ───────────────────────────────────────────────────────
export const repo = {
  async registerOrGet(phone: string, name?: string, email?: string): Promise<Profile> {
    for (const p of db.profiles.values()) if (p.phone === phone) return p;
    const id = uid();
    const profile: Profile = {
      id,
      vault_id: "VP" + String(Math.floor(100000 + Math.random() * 899999)),
      full_name: name || null,
      phone,
      email: email || null,
      kyc_status: "pending",
      pan_masked: null,
    };
    db.profiles.set(id, profile);
    getWallet(id, "gold");
    getWallet(id, "silver");
    return profile;
  },

  getProfile(id: string) {
    return db.profiles.get(id);
  },
  listProfiles() {
    return [...db.profiles.values()];
  },

  getWallet(userId: string, metal: "gold" | "silver") {
    const w = getWallet(userId, metal);
    w.last_price_inr = db.prices[metal].buy_price_per_gram;
    return w;
  },

  getPrices(): Price[] {
    return [db.prices.gold, db.prices.silver];
  },

  // ── BUY: ledger-as-truth + outbox + idempotent SafeGold ──────────────
  async buy(userId: string, metal: "gold" | "silver", inr: number) {
    const price = db.prices[metal];
    const buyIncGst = price.buy_price_per_gram; // already incl spread + GST in mock
    const grams = round6(inr / buyIncGst);
    const requestId = rid();
    const txnId = "VPT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(db.transactions.length + 1).padStart(6, "0");
    const txn: Transaction = {
      id: uid(),
      tax_id: txnId,
      user_id: userId,
      txn_type: "buy",
      metal_type: metal,
      amount_grams: grams,
      amount_inr: round2(inr),
      price_per_gram: buyIncGst,
      fee_inr: round2(inr * SPREAD),
      status: "processing",
      counterparty_id: null,
      created_at: now(),
    };
    db.transactions.push(txn);
    // ledger credit (custody) + spread fee to platform
    postLedger([
      { user_id: userId, metal_type: metal, entry_type: "credit", amount_grams: grams, txn_ref: txn.id, request_id: requestId, note: "buy" },
    ]);
    db.feeLedger.push({ id: uid(), transaction_id: txn.id, user_id: userId, fee_type: "spread", fee_inr: round2(inr * SPREAD), fee_grams: 0, created_at: now() });
    accrue("spread", round2(inr * SPREAD), 0);
    // atomic outbox → SafeGold buy (idempotent)
    db.outbox.push({
      id: uid(),
      topic: "safegold.buy",
      payload: { user_id: userId, metal, grams, rate_id: "mock", client_reference_id: txnId },
      request_id: requestId,
      status: "pending",
      attempts: 0,
    });
    txn.status = "completed";
    notify(userId, "Gold purchased", `${grams}g ${metal} added to your vault.`);
    drainOutbox();
    return txn;
  },

  // ── SELL (locked by row-lock semantics; here serialized by getWallet) ──
  async sell(userId: string, metal: "gold" | "silver", grams: number) {
    const w = getWallet(userId, metal);
    if (w.balance_grams - w.locked_grams < grams) throw new Error("INSUFFICIENT_BALANCE");
    const price = db.prices[metal];
    const inr = round2(grams * price.sell_price_per_gram);
    const requestId = rid();
    const txnId = "VPT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(db.transactions.length + 1).padStart(6, "0");
    const txn: Transaction = {
      id: uid(),
      tax_id: txnId,
      user_id: userId,
      txn_type: "sell",
      metal_type: metal,
      amount_grams: grams,
      amount_inr: inr,
      price_per_gram: price.sell_price_per_gram,
      fee_inr: round2(inr * SPREAD),
      status: "processing",
      counterparty_id: null,
      created_at: now(),
    };
    db.transactions.push(txn);
    postLedger([{ user_id: userId, metal_type: metal, entry_type: "debit", amount_grams: grams, txn_ref: txn.id, request_id: requestId, note: "sell" }]);
    db.feeLedger.push({ id: uid(), transaction_id: txn.id, user_id: userId, fee_type: "spread", fee_inr: round2(inr * SPREAD), fee_grams: 0, created_at: now() });
    accrue("spread", round2(inr * SPREAD), 0);
    db.outbox.push({
      id: uid(),
      topic: "safegold.sell",
      payload: { user_id: userId, metal, grams, client_reference_id: txnId },
      request_id: requestId,
      status: "pending",
      attempts: 0,
    });
    txn.status = "completed";
    notify(userId, "Gold sold", `${grams}g ${metal} sold for ₹${inr}.`);
    drainOutbox();
    return txn;
  },

  // ── P2P (atomic ledger, fee to accumulator, SafeGold transfer async) ───
  async p2p(senderId: string, to: string, metal: "gold" | "silver", grams: number, message?: string) {
    const receiver = [...db.profiles.values()].find(
      (p) => p.vault_id === to || p.phone === to || p.email === to
    );
    if (!receiver) throw new Error("RECEIVER_NOT_FOUND");
    if (receiver.id === senderId) throw new Error("SELF_TRANSFER");
    const sw = getWallet(senderId, metal);
    const feeGrams = round6(grams * P2P_FEE);
    if (sw.balance_grams - sw.locked_grams < round6(grams + feeGrams)) throw new Error("INSUFFICIENT_BALANCE");
    const requestId = rid();
    const transferId = "VPP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(db.transfers.length + 1).padStart(6, "0");
    const price = db.prices[metal];
    const inr = round2(grams * price.buy_price_per_gram);
    const txn: Transaction = {
      id: uid(),
      tax_id: transferId,
      user_id: senderId,
      txn_type: "p2p_send",
      metal_type: metal,
      amount_grams: grams,
      amount_inr: inr,
      price_per_gram: price.buy_price_per_gram,
      fee_inr: round2(inr * P2P_FEE),
      status: "completed",
      counterparty_id: receiver.id,
      created_at: now(),
    };
    db.transactions.push(txn);
    db.transactions.push({
      ...txn,
      id: uid(),
      user_id: receiver.id,
      txn_type: "p2p_receive",
      counterparty_id: senderId,
      tax_id: "VPP-" + transferId.slice(4),
    });
    const transfer: P2PTransfer = {
      id: uid(),
      transfer_id: transferId,
      sender_id: senderId,
      receiver_id: receiver.id,
      metal_type: metal,
      amount_grams: grams,
      amount_inr: inr,
      fee_grams: feeGrams,
      fee_inr: round2(inr * P2P_FEE),
      message: message || null,
      status: "initiated",
      created_at: now(),
    };
    db.transfers.push(transfer);
    postLedger([
      { user_id: senderId, metal_type: metal, entry_type: "debit", amount_grams: round6(grams + feeGrams), txn_ref: txn.id, request_id: requestId, note: "p2p_send" },
      { user_id: receiver.id, metal_type: metal, entry_type: "credit", amount_grams: grams, txn_ref: txn.id, request_id: requestId, note: "p2p_receive" },
    ]);
    db.feeLedger.push({ id: uid(), transaction_id: txn.id, user_id: senderId, fee_type: "p2p_fee", fee_inr: round2(inr * P2P_FEE), fee_grams: feeGrams, created_at: now() });
    accrue("p2p_fee", round2(inr * P2P_FEE), feeGrams);
    db.outbox.push({
      id: uid(),
      topic: "safegold.transfer",
      payload: { from_user_id: senderId, to_user_id: receiver.id, metal, grams, client_reference_id: transferId },
      request_id: requestId,
      status: "pending",
      attempts: 0,
    });
    transfer.status = "completed";
    notify(senderId, "Transfer sent", `${grams}g ${metal} sent to ${receiver.full_name || receiver.vault_id}.`);
    notify(receiver.id, "Gold received", `You received ${grams}g ${metal} from ${db.profiles.get(senderId)?.full_name || ""}.`);
    drainOutbox();
    return transfer;
  },

  // ── GIFT (7-day link; claim credits receiver) ───────────────────────────
  async giftCreate(senderId: string, metal: "gold" | "silver", grams: number, message?: string) {
    const sw = getWallet(senderId, metal);
    if (sw.balance_grams - sw.locked_grams < grams) throw new Error("INSUFFICIENT_BALANCE");
    const token = rid();
    const gift: GiftLink = {
      id: uid(),
      token,
      sender_id: senderId,
      metal_type: metal,
      amount_grams: grams,
      message: message || null,
      status: "created",
      claimed_by: null,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      claim_url: `/gift/${token}`,
    };
    db.gifts.push(gift);
    const requestId = rid();
    postLedger([{ user_id: senderId, metal_type: metal, entry_type: "debit", amount_grams: grams, txn_ref: gift.id, request_id: requestId, note: "gift_send" }]);
    notify(senderId, "Gift created", `Shareable gift of ${grams}g ${metal} generated.`);
    return gift;
  },
  async giftClaim(token: string) {
    const gift = db.gifts.find((g) => g.token === token);
    if (!gift) throw new Error("GIFT_NOT_FOUND");
    if (gift.status !== "created") throw new Error("GIFT_USED");
    if (new Date(gift.expires_at) < new Date()) {
      gift.status = "expired";
      throw new Error("GIFT_EXPIRED");
    }
    return gift;
  },

  // ── reconciliation (§E): compare SafeGold custody vs local ledger ────────
  async reconcile() {
    const breaks: any[] = [];
    for (const p of db.profiles.values()) {
      for (const metal of ["gold", "silver"] as const) {
        const local = round6(runningBalance(p.id, metal));
        const sg = await safegold.getBalance(p.id, metal);
        const delta = round6(Math.abs(local - sg));
        if (delta > 0.000001) breaks.push({ user_id: p.id, metal, local, sg, delta });
      }
    }
    return breaks;
  },

  feeAccum() {
    return db.feeAccum;
  },
  transactions(userId?: string) {
    return db.transactions.filter((t) => !userId || t.user_id === userId).reverse();
  },
  transfers() {
    return db.transfers.reverse();
  },
  gifts(userId: string) {
    return db.gifts.filter((g) => g.sender_id === userId).reverse();
  },
  notifications(userId: string) {
    return db.notifications.filter((n) => n.user_id === userId).reverse();
  },
  ledger(userId: string) {
    return db.ledger.filter((l) => l.user_id === userId).reverse();
  },
};

function accrue(type: string, inr: number, grams: number) {
  const a = db.feeAccum[type] || (db.feeAccum[type] = { total_inr: 0, total_grams: 0, today_inr: 0 });
  a.total_inr = round2(a.total_inr + inr);
  a.total_grams = round6(a.total_grams + grams);
  a.today_inr = round2(a.today_inr + inr);
}

// demo seed: give the first registered user some gold so the dashboard isn't empty
export function seedDemo(userId: string, metal: "gold" | "silver", grams: number) {
  postLedger([{ user_id: userId, metal_type: metal, entry_type: "credit", amount_grams: grams, txn_ref: "seed", request_id: "seed", note: "seed" }]);
}

// ── DEMO DATA (mock mode only) ──────────────────────────────────────────
// Populates realistic accounts + history on first load so the app looks alive
// with zero external APIs. Called once from the module init below.
function seedIfEmpty() {
  if (db.profiles.size > 0) return;

  const demo = [
    { phone: "9999900001", name: "Aarav Sharma", kyc: "verified" as const, gold: 12.5, silver: 120, vault: "VP100001" },
    { phone: "9999900002", name: "Priya Nair", kyc: "verified" as const, gold: 4.2, silver: 0, vault: "VP100002" },
    { phone: "9999900003", name: "Rohan Mehta", kyc: "pending" as const, gold: 1.1, silver: 35, vault: "VP100003" },
  ];
  const ids: Record<string, string> = {};
  demo.forEach((d, i) => {
    const id = uid();
    ids[d.phone] = id;
    db.profiles.set(id, {
      id,
      vault_id: d.vault,
      full_name: d.name,
      phone: d.phone,
      email: d.name.toLowerCase().replace(/\s/g, ".") + "@example.com",
      kyc_status: d.kyc,
      pan_masked: "ABCDE" + String(1000 + i) + "X",
    });
    // seed custody balances via ledger (materialized into wallets)
    postLedger([{ user_id: id, metal_type: "gold", entry_type: "credit", amount_grams: d.gold, txn_ref: "seed", request_id: "seed", note: "seed" }]);
    if (d.silver > 0)
      postLedger([{ user_id: id, metal_type: "silver", entry_type: "credit", amount_grams: d.silver, txn_ref: "seed", request_id: "seed", note: "seed" }]);
  });

  // demo transactions for Aarav
  const aarav = ids["9999900001"];
  const txns: any[] = [
    { metal: "gold", type: "buy", grams: 5, inr: 38700 },
    { metal: "silver", type: "buy", grams: 100, inr: 9240 },
    { metal: "gold", type: "sell", grams: 1.5, inr: 11460 },
  ];
  txns.forEach((t) => {
    const price = db.prices[t.metal as "gold" | "silver"];
    const inr = t.inr ?? Math.round(t.grams * price.buy_price_per_gram);
    const taxId = "VPT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(db.transactions.length + 1).padStart(6, "0");
    db.transactions.push({
      id: uid(), tax_id: taxId, user_id: aarav, txn_type: t.type as any, metal_type: t.metal,
      amount_grams: t.grams, amount_inr: inr, price_per_gram: price.buy_price_per_gram,
      fee_inr: Math.round(inr * SPREAD), status: "completed", counterparty_id: null, created_at: now(),
    });
    accrue("spread", Math.round(inr * SPREAD), 0);
  });

  // demo P2P: Aarav -> Priya 2g gold
  const priya = ids["9999900002"];
  db.transfers.push({
    id: uid(),
    transfer_id: "VPP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-000001",
    sender_id: aarav, receiver_id: priya, metal_type: "gold", amount_grams: 2, amount_inr: 15420,
    fee_grams: round6(2 * P2P_FEE), fee_inr: Math.round(15420 * P2P_FEE), message: "Rent share", status: "completed", created_at: now(),
  });
  postLedger([
    { user_id: aarav, metal_type: "gold", entry_type: "debit", amount_grams: round6(2 + 2 * P2P_FEE), txn_ref: "seed", request_id: "seed", note: "p2p_send" },
    { user_id: priya, metal_type: "gold", entry_type: "credit", amount_grams: 2, txn_ref: "seed", request_id: "seed", note: "p2p_receive" },
  ]);
  accrue("p2p_fee", Math.round(15420 * P2P_FEE), round6(2 * P2P_FEE));

  // demo gift link (unclaimed)
  db.gifts.push({
    id: uid(), token: "demogift" + rid().slice(0, 8), sender_id: aarav, metal_type: "gold", amount_grams: 0.5,
    message: "Congratulations!", status: "created", claimed_by: null, expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    claim_url: "/gift/demogift",
  });

  // demo notifications
  notify(aarav, "Welcome to VaultPayz", "Your vault is ready. KYC verified — full limits unlocked.");
  notify(aarav, "Gold received", "Priya Nair sent you 2g gold.");
  notify(priya, "Gold received", "Aarav Sharma sent you 2g gold.");
}
if ((process.env.SEED_DEMO_DATA ?? "true") !== "false") seedIfEmpty();
