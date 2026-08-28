import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser, body } from "@/lib/api";

export async function POST(req: Request) {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  const { metal, grams, message } = await body(req);
  if (!metal || !grams || grams <= 0) return err("INVALID_INPUT", "metal + grams required");
  try {
    const g = await repo.giftCreate(u.id, metal, Number(grams), message);
    return ok(g);
  } catch (e: any) {
    return err("GIFT_FAILED", e.message);
  }
}
