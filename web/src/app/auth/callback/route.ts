import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { grantParentMode } from "@/lib/auth/mode";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { isLocalMode } from "@/lib/config";

/** Supabase 註冊確認信的回呼：PKCE 的 code，或 token_hash＋type；確認成功就是家長本人，直接進家長模式 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (isLocalMode()) return NextResponse.redirect(new URL("/login", url));
  const supabase = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let userId: string | null = null;
  if (code) userId = (await supabase.auth.exchangeCodeForSession(code)).data.user?.id ?? null;
  else if (tokenHash && type) userId = (await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).data.user?.id ?? null;
  if (!userId) return NextResponse.redirect(new URL("/login?error=confirm", url));
  await grantParentMode(userId);
  return NextResponse.redirect(new URL("/", url));
}
