import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().delete("vp_uid");
  return NextResponse.json({ success: true });
}
