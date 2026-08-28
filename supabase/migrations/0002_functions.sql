-- VaultPayz functions & triggers (addendum v1.1)
-- Implements: ledger-as-truth materialization, tax_id / vault_id generators,
-- fee accumulator trigger, immutable audit log, outbox relay hook.

-- 1) MATERIALIZE wallet balance from ledger (the ONLY writer of wallets.balance_grams)
CREATE OR REPLACE FUNCTION public.apply_ledger_to_wallet()
RETURNS TRIGGER AS $$
DECLARE
  d NUMERIC(18,6);
  new_bal NUMERIC(18,6);
BEGIN
  -- delta = credit adds, debit subtracts
  d := CASE WHEN NEW.entry_type = 'credit' THEN NEW.amount_grams ELSE -NEW.amount_grams END;
  -- upsert wallet row for this user+metal (ignore 'system' rows that move platform acct)
  INSERT INTO public.wallets (user_id, metal_type, balance_grams)
    VALUES (NEW.user_id, NEW.metal_type, GREATEST(0, d))
  ON CONFLICT (user_id, metal_type)
    DO UPDATE SET balance_grams = GREATEST(0, public.wallets.balance_grams + d),
                  updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ledger_to_wallet
  AFTER INSERT ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_ledger_to_wallet();

-- 2) generate vault_id = VP + 6 digits
CREATE OR REPLACE FUNCTION public.generate_vault_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vault_id IS NULL THEN
    NEW.vault_id := 'VP' || lpad(floor(random()*900000+100000)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vault_id BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_vault_id();

-- 3) generate tax_id / transfer_id with daily sequence (partition by day)
CREATE OR REPLACE FUNCTION public.next_seq(day DATE) RETURNS INT AS $$
DECLARE s INT;
BEGIN
  INSERT INTO public.daily_seq (day, n) VALUES (day, 1)
    ON CONFLICT (day) DO UPDATE SET n = public.daily_seq.n + 1
    RETURNING n INTO s;
  RETURN s;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.daily_seq (
  day DATE PRIMARY KEY,
  n INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_tax_id()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  d DATE := DATE(NEW.created_at);
  s INT;
  ymd TEXT;
BEGIN
  prefix := CASE NEW.txn_type
    WHEN 'p2p_send' THEN 'VPP'
    WHEN 'gift_send' THEN 'VPG'
    ELSE 'VPT' END;
  ymd := to_char(d, 'YYYYMMDD');
  s := public.next_seq(d);
  NEW.tax_id := prefix || '-' || ymd || '-' || lpad(s::text, 6, '0');
  -- also record in tax_id_map
  INSERT INTO public.tax_id_map (tax_id, transaction_id, fiscal_day, seq)
    VALUES (NEW.tax_id, NEW.id, d, s)
  ON CONFLICT (tax_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tax_id BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.generate_tax_id();

-- p2p_transfer_id
CREATE OR REPLACE FUNCTION public.generate_p2p_id()
RETURNS TRIGGER AS $$
DECLARE s INT; d DATE := DATE(NEW.created_at); ymd TEXT;
BEGIN
  ymd := to_char(d, 'YYYYMMDD');
  s := public.next_seq(d);
  NEW.transfer_id := 'VPP-' || ymd || '-' || lpad(s::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_p2p_id BEFORE INSERT ON public.p2p_transfers
  FOR EACH ROW EXECUTE FUNCTION public.generate_p2p_id();

-- 4) accumulate fees on fee_ledger insert
CREATE OR REPLACE FUNCTION public.accumulate_fees()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.fee_accumulator
    SET total_inr = total_inr + NEW.fee_inr,
        total_grams = total_grams + COALESCE(NEW.fee_grams, 0),
        today_inr = today_inr + NEW.fee_inr,
        this_month_inr = this_month_inr + NEW.fee_inr,
        last_updated = NOW()
  WHERE fee_type = NEW.fee_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accumulate_fees AFTER INSERT ON public.fee_ledger
  FOR EACH ROW EXECUTE FUNCTION public.accumulate_fees();

-- 5) immutable audit log on sensitive tables (INSERT-only table enforced at role level)
CREATE OR REPLACE FUNCTION public.log_to_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (actor_type, actor_id, action, table_name, row_id, diff_json)
  VALUES (
    COALESCE(current_setting('app.actor_type', true), 'system'),
    NULLIF(current_setting('app.actor_id', true), '')::uuid,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_profiles AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();
CREATE TRIGGER trg_audit_wallets AFTER UPDATE OR DELETE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();
CREATE TRIGGER trg_audit_txn AFTER UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();
CREATE TRIGGER trg_audit_p2p AFTER UPDATE OR DELETE ON public.p2p_transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_to_audit();

-- 6) auto updated_at
CREATE OR REPLACE FUNCTION public.auto_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_updated_at();
CREATE TRIGGER trg_updated_wallets BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.auto_updated_at();
CREATE TRIGGER trg_updated_kyc BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_updated_at();

-- 7) check wallet balance before P2P (defense in depth; app also checks)
CREATE OR REPLACE FUNCTION public.check_wallet_balance()
RETURNS TRIGGER AS $$
DECLARE avail NUMERIC(18,6);
BEGIN
  SELECT balance_grams - locked_grams INTO avail FROM public.wallets
    WHERE user_id = NEW.sender_id AND metal_type = NEW.metal_type FOR UPDATE;
  IF avail < NEW.amount_grams + NEW.fee_grams THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_balance BEFORE INSERT ON public.p2p_transfers
  FOR EACH ROW EXECUTE FUNCTION public.check_wallet_balance();

-- make audit_log + outbox append-only at the DB level (revoke UPDATE/DELETE from all)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.outbox FROM anon, authenticated;

-- ── Row Level Security ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_own ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY w_own ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wl_own ON public.wallet_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY t_own ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY p2p_own ON public.p2p_transfers FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY g_own ON public.gift_links FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = claimed_by);
CREATE POLICY k_own ON public.kyc_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY b_own ON public.bank_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY n_own ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY s_own ON public.sip_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tax_own ON public.tax_records FOR SELECT USING (auth.uid() = user_id);
-- fee_ledger / admin_reports / audit_log / reconciliation_breaks: admin only (service_role in backend)
