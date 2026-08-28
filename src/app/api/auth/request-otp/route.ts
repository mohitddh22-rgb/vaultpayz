import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, setSession } from "@/lib/api";
import { body } from "@/lib/api";

export async function POST(req: Request) {
  const { phone, name, email } = await body(req);
  if (!phone) return err("INVALID_INPUT", "phone required");
  // In mock mode we "auto-verify" the OTP. Real mode: call Supabase Auth OTP.
  const profile = await repo.registerOrGet(phone, name, email);
  setSession(profile.id);
  return ok({ vault_id: profile.vault_id, phone: profile.phone, kyc_status: profile.kyc_status });
}
