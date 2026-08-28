import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok, err, sessionUser, body } from "@/lib/api";

export async function POST(req: Request) {
  const u = await sessionUser();
  if (!u) return err("UNAUTHENTICATED", "not logged in", 401);
  const { to, metal, grams, message } = await body(req);
  if (!to || !metal || !grams || grams <= 0) return err("INVALID_INPUT", "to + metal + grams required");
  try {
    const t = await repo.p2p(u.id, String(to), metal, Number(grams), message);
    return ok(t);
  } catch (e: any) {
    return err(mapCode(e.message), e.message);
  }
}
function mapCode(m: string) {
  if (m === "RECEIVER_NOT_FOUND") return "RECEIVER_NOT_FOUND";
  if (m === "SELF_TRANSFER") return "SELF_TRANSFER";
  if (m === "INSUFFICIENT_BALANCE") return "INSUFFICIENT_BALANCE";
  return "TRANSFER_FAILED";
}
