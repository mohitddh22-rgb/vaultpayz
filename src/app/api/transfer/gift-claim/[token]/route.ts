import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const gift = await repo.giftClaim(params.token);
    return ok(gift);
  } catch (e: any) {
    return err("GIFT_FAILED", e.message, 404);
  }
}

// POST would credit the claiming user after registration (mock: returns gift).
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const gift = await repo.giftClaim(params.token);
    return ok(gift);
  } catch (e: any) {
    return err("GIFT_FAILED", e.message, 404);
  }
}
