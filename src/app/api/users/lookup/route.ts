import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser } from "@/lib/api";

export async function GET(req: Request) {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q) return err("INVALID_INPUT", "q required");
  const found =
    repo
      .listProfiles()
      .find((p) => p.vault_id === q || p.phone === q || p.email === q) || null;
  if (!found) return ok({ found: false });
  // never expose PAN/Aadhaar
  return ok({
    found: true,
    vault_id: found.vault_id,
    name: found.full_name,
    phone_masked: found.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1XXXXXX$2"),
  });
}
