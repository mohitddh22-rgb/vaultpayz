import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok } from "@/lib/api";

// Demo-only admin view (real mode: gate behind admin JWT + 2FA).
export async function GET() {
  return ok({ fee_accumulator: repo.feeAccum(), transfers: repo.transfers(), users: repo.listProfiles().length });
}
