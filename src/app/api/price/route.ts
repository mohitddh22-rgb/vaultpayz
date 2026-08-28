import { NextResponse } from "next/server";
import { repo } from "@/lib/store";
import { ok } from "@/lib/api";

export async function GET() {
  return ok(repo.getPrices());
}
