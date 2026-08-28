import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser } from "@/lib/api";

export async function GET() {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  const gold = repo.getWallet(u.id, "gold");
  const silver = repo.getWallet(u.id, "silver");
  return ok({
    gold,
    silver,
    gold_inr: Math.round(gold.balance_grams * gold.last_price_inr),
    silver_inr: Math.round(silver.balance_grams * silver.last_price_inr),
  });
}
