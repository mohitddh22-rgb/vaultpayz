import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser } from "@/lib/api";

export async function GET() {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  return ok({ profile: u, wallets: [repo.getWallet(u.id, "gold"), repo.getWallet(u.id, "silver")] });
}
