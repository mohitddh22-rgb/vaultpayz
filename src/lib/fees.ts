export const FEES = {
  // P2P transfer fee (0.33% of grams) — v1.0 §12.2 / §13.1
  p2pFeeRate: Number(process.env.P2P_FEE_RATE ?? "0.0033"),
  // Buy/Sell spread (1.5%) — v1.0 §13.1
  spreadRate: Number(process.env.SPREAD_RATE ?? "0.015"),
  // SafeGold commission passed to VaultPayz (1.75%) — onboarding email
  sgCommissionRate: 0.0175,
  // AMC ₹300/user/yr, delivery ₹250 — v1.0 §13.1
  amcInr: 300,
  deliveryInr: 250,
};
