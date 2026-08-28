// Shared domain types — mirror the addendum v1.1 schema.
export type Metal = "gold" | "silver";
export type TxnType =
  | "buy"
  | "sell"
  | "p2p_send"
  | "p2p_receive"
  | "gift_send"
  | "gift_receive"
  | "sip"
  | "delivery"
  | "fee"
  | "refund";

export interface Profile {
  id: string;
  vault_id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  pan_masked: string | null;
}

export interface WalletBalance {
  user_id: string;
  metal_type: Metal;
  balance_grams: number;
  locked_grams: number;
  last_price_inr: number;
}

export interface Price {
  metal_type: Metal;
  spot_price_per_gram: number;
  buy_price_per_gram: number;
  sell_price_per_gram: number;
  fetched_at: string;
}

export interface Transaction {
  id: string;
  tax_id: string;
  user_id: string;
  txn_type: TxnType;
  metal_type: Metal;
  amount_grams: number;
  amount_inr: number;
  price_per_gram: number;
  fee_inr: number;
  status: "pending" | "processing" | "completed" | "failed" | "reversed";
  counterparty_id: string | null;
  created_at: string;
}

export interface P2PTransfer {
  id: string;
  transfer_id: string;
  sender_id: string;
  receiver_id: string;
  metal_type: Metal;
  amount_grams: number;
  amount_inr: number;
  fee_grams: number;
  fee_inr: number;
  message: string | null;
  status: "initiated" | "completed" | "failed" | "reversed";
  created_at: string;
}

export interface GiftLink {
  id: string;
  token: string;
  sender_id: string;
  metal_type: Metal;
  amount_grams: number;
  message: string | null;
  status: "created" | "claimed" | "expired" | "reversed";
  claimed_by: string | null;
  expires_at: string;
  claim_url: string;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
