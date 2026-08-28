import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser, body } from "@/lib/api";

export async function POST(req: Request) {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  const { metal, inr } = await body(req);
  if (!metal || !inr || inr <= 0) return err("INVALID_INPUT", "metal + inr required");
  try {
    const txn = await repo.buy(u.id, metal, Number(inr));
    return ok(txn);
  } catch (e: any) {
    return err("BUY_FAILED", e.message);
  }
}
