-- VaultPayz schema — addendum v1.1 corrected architecture (ledger-as-truth)
-- Run in Supabase SQL Editor. Mirrors src/lib/store.ts logic in SQL.

-- ── enums ───────────────────────────────────────────────────────────────
CREATE TYPE metal_t AS ENUM ('gold','silver');
CREATE TYPE txn_type_t AS ENUM ('buy','sell','p2p_send','p2p_receive','gift_send','gift_receive','sip','delivery','fee','refund');
CREATE TYPE txn_status_t AS ENUM ('pending','processing','completed','failed','reversed');
CREATE TYPE entry_t AS ENUM ('credit','debit');

-- ── profiles (PAN single source = kyc_documents; here only masked) ──────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id VARCHAR(12) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  phone VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  date_of_birth DATE,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','submitted','verified','rejected')),
  pan_masked VARCHAR(12),
  pan_verified BOOLEAN DEFAULT FALSE,
  safegold_user_id VARCHAR(50) UNIQUE,
  referral_code VARCHAR(10) UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── wallets (MATERIALIZED from ledger; never written by app code) ───────
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metal_type metal_t NOT NULL,
  balance_grams NUMERIC(18,6) NOT NULL DEFAULT 0,
  locked_grams NUMERIC(18,6) NOT NULL DEFAULT 0,
  safegold_account_id VARCHAR(50),
  last_price_inr NUMERIC(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metal_type)
);

-- ── wallet_ledger (SINGLE SOURCE OF TRUTH, append-only) ─────────────────
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metal_type metal_t NOT NULL,
  entry_type entry_t NOT NULL,
  amount_grams NUMERIC(18,6) NOT NULL CHECK (amount_grams > 0),
  balance_after_grams NUMERIC(18,6) NOT NULL,
  txn_ref UUID,
  request_id UUID NOT NULL,
  note VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_user ON public.wallet_ledger(user_id, metal_type, created_at);

-- ── transactions / p2p / gift ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  txn_type txn_type_t NOT NULL,
  metal_type metal_t NOT NULL,
  amount_grams NUMERIC(18,6) NOT NULL,
  amount_inr NUMERIC(14,2) NOT NULL,
  price_per_gram NUMERIC(12,4) NOT NULL,
  fee_inr NUMERIC(10,2) DEFAULT 0,
  tds_inr NUMERIC(10,2) DEFAULT 0,
  status txn_status_t NOT NULL DEFAULT 'pending',
  payment_order_id UUID,
  safegold_order_id VARCHAR(50),
  counterparty_id UUID REFERENCES public.profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_txn_user ON public.transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS public.p2p_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id VARCHAR(20) UNIQUE NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  receiver_id UUID NOT NULL REFERENCES public.profiles(id),
  metal_type metal_t NOT NULL,
  amount_grams NUMERIC(18,6) NOT NULL,
  amount_inr NUMERIC(14,2) NOT NULL,
  fee_grams NUMERIC(18,6) DEFAULT 0,
  fee_inr NUMERIC(10,2) DEFAULT 0,
  safegold_transfer_id VARCHAR(50),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','completed','failed','reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gift_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(40) UNIQUE NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  metal_type metal_t NOT NULL,
  amount_grams NUMERIC(18,6) NOT NULL,
  amount_inr NUMERIC(14,2),
  fee_grams NUMERIC(18,6) DEFAULT 0,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','claimed','expired','reversed')),
  claimed_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── fees / revenue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fee_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id),
  user_id UUID REFERENCES public.profiles(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('spread','p2p_fee','sg_commission','amc','delivery')),
  fee_inr NUMERIC(10,2) NOT NULL,
  fee_grams NUMERIC(18,6) DEFAULT 0,
  metal_type metal_t,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.fee_accumulator (
  fee_type TEXT PRIMARY KEY CHECK (fee_type IN ('spread','p2p_fee','sg_commission','amc','delivery')),
  total_inr NUMERIC(16,2) DEFAULT 0,
  total_grams NUMERIC(18,6) DEFAULT 0,
  today_inr NUMERIC(14,2) DEFAULT 0,
  this_month_inr NUMERIC(14,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.fee_accumulator (fee_type) VALUES ('spread'),('p2p_fee'),('sg_commission'),('amc'),('delivery')
ON CONFLICT DO NOTHING;

-- ── outbox (saga relay) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL,
  request_id UUID UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','dead')),
  attempts INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  done_at TIMESTAMPTZ
);
CREATE INDEX idx_outbox_pending ON public.outbox(status, next_retry_at) WHERE status='pending';

-- ── safegold / payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safegold_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  op VARCHAR(30) NOT NULL,
  request_id UUID UNIQUE,
  request_payload JSONB,
  response_payload JSONB,
  http_status INT,
  safegold_ref VARCHAR(50),
  status TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.safegold_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metal_type metal_t NOT NULL,
  buy_price_per_gram NUMERIC(12,4) NOT NULL,
  sell_price_per_gram NUMERIC(12,4) NOT NULL,
  spot_price_per_gram NUMERIC(12,4),
  source VARCHAR(20),
  fetched_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  razorpay_order_id VARCHAR(50) UNIQUE,
  receipt VARCHAR(40) UNIQUE,
  metal_type metal_t NOT NULL,
  amount_inr NUMERIC(14,2) NOT NULL,
  grams_ordered NUMERIC(18,6),
  locked_price_per_gram NUMERIC(12,4) NOT NULL,
  lock_expires_at TIMESTAMPTZ NOT NULL,
  txn_type txn_type_t NOT NULL,
  status TEXT DEFAULT 'created' CHECK (status IN ('created','paid','failed','expired','executed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(20) NOT NULL,
  event_id VARCHAR(80) NOT NULL,
  event_type VARCHAR(40),
  raw_body JSONB NOT NULL,
  signature_ok BOOLEAN,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gateway, event_id)
);

-- ── kyc / bank / tax ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  pan_number TEXT,                      -- encrypted via pgcrypto (app layer or column enc)
  aadhaar_last4 CHAR(4),
  aadhaar_verified BOOLEAN,
  pan_verified BOOLEAN,
  selfie_url TEXT,
  pan_doc_url TEXT,
  aadhaar_doc_url TEXT,
  liveness_score NUMERIC(5,2),
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  reviewer_id UUID,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  account_number TEXT,                  -- encrypted AES-256
  account_number_masked VARCHAR(20),
  ifsc_code VARCHAR(11) NOT NULL,
  bank_name VARCHAR(100),
  account_holder_name VARCHAR(100),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','failed')),
  razorpay_fund_account_id VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  transaction_id UUID REFERENCES public.transactions(id),
  pan_number VARCHAR(10),
  tds_applicable BOOLEAN DEFAULT FALSE,
  tds_rate NUMERIC(5,2) DEFAULT 0,
  tds_amount_inr NUMERIC(10,2) DEFAULT 0,
  gross_amount_inr NUMERIC(14,2) NOT NULL,
  financial_year CHAR(7) NOT NULL,
  form_26as_ref VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.tax_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id VARCHAR(20) UNIQUE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  fiscal_day DATE NOT NULL,
  seq INT NOT NULL
);

-- ── sip / delivery / notifications / reports / audit / admin ────────────
CREATE TABLE IF NOT EXISTS public.sip_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  metal_type metal_t NOT NULL,
  amount_inr NUMERIC(14,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  mandate_id VARCHAR(50),
  next_execution_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.sip_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sip_id UUID REFERENCES public.sip_plans(id) ON DELETE CASCADE,
  payment_order_id UUID,
  status TEXT DEFAULT 'success',
  grams NUMERIC(18,6),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  metal_type metal_t NOT NULL,
  grams NUMERIC(18,6) NOT NULL,
  delivery_fee_inr NUMERIC(10,2),
  address_json JSONB,
  brinks_ref VARCHAR(50),
  tracking_url TEXT,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested','confirmed','shipped','delivered','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel VARCHAR(12) NOT NULL CHECK (channel IN ('push','sms','email','inapp')),
  event VARCHAR(40),
  title VARCHAR(120),
  body TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','read')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.admin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE UNIQUE NOT NULL,
  total_users INT DEFAULT 0,
  new_users_today INT DEFAULT 0,
  kyc_verified_today INT DEFAULT 0,
  kyc_pending_count INT DEFAULT 0,
  total_gmv_inr NUMERIC(16,2) DEFAULT 0,
  gold_gmv_inr NUMERIC(16,2) DEFAULT 0,
  silver_gmv_inr NUMERIC(16,2) DEFAULT 0,
  buy_count INT DEFAULT 0,
  sell_count INT DEFAULT 0,
  p2p_count INT DEFAULT 0,
  gift_count INT DEFAULT 0,
  total_revenue_inr NUMERIC(16,2) DEFAULT 0,
  spread_revenue NUMERIC(14,2) DEFAULT 0,
  p2p_revenue NUMERIC(14,2) DEFAULT 0,
  amc_revenue NUMERIC(14,2) DEFAULT 0,
  delivery_revenue NUMERIC(14,2) DEFAULT 0,
  safegold_wallet_balance NUMERIC(16,2) DEFAULT 0,
  aml_flags_today INT DEFAULT 0,
  failed_transactions_today INT DEFAULT 0,
  new_sip_plans_today INT DEFAULT 0,
  sip_executions_today INT DEFAULT 0,
  recon_breaks_today INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.reconciliation_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  sg_grams NUMERIC(18,6),
  local_grams NUMERIC(18,6),
  delta_grams NUMERIC(18,6),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(12) NOT NULL CHECK (actor_type IN ('user','admin','system','cron')),
  actor_id UUID,
  action VARCHAR(60),
  table_name VARCHAR(40),
  row_id UUID,
  diff_json JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','compliance','finance','support')),
  totp_secret TEXT,
  ip_whitelist INET[],
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.system_config (
  key VARCHAR(40) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_by UUID REFERENCES public.admin_users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.system_config (key, value_json) VALUES
  ('p2p_single_max_grams', '{"v":50}'),
  ('p2p_daily_max_grams', '{"v":200}'),
  ('transfer_min_grams', '{"v":0.001}'),
  ('price_lock_seconds', '{"v":60}'),
  ('kyc_required_threshold_inr', '{"v":50000}'),
  ('maintenance_mode', '{"v":false}'),
  ('safegold_low_balance_alert', '{"v":1000000}')
ON CONFLICT DO NOTHING;
