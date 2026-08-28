import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { repo } from "./store";
import type { ApiResult } from "./types";

const COOKIE = "vp_uid";

export async function body(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function sessionUser() {
  const c = cookies().get(COOKIE);
  return c?.value ? repo.getProfile(c.value) : null;
}

export function ok<T>(data: T) {
  const r: ApiResult<T> = { success: true, data };
  return NextResponse.json(r);
}

export function err(code: string, message: string, status = 400) {
  const r: ApiResult<null> = { success: false, error: { code, message } };
  return NextResponse.json(r, { status });
}

export function setSession(userId: string) {
  cookies().set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
