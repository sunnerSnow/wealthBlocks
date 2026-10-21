"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logError } from "@/lib/api/http";
import { LOCAL_SESSION_COOKIE, LOCAL_USERS } from "@/lib/auth/local-users";
import { clearModes, enterKidMode, grantParentMode, leaveKidMode, readPlayMode } from "@/lib/auth/mode";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { isLocalMode } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { addChild, listChildren } from "@/lib/services/children";
import { checkParentPin, setupFamily } from "@/lib/services/family";

/**
 * Server Actions 都是公開的 POST 端點：每一個都自己檢查登入與模式，輸入一律交給服務層驗證。
 */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  done?: boolean;
  /** 送出失敗時帶回原本填的值（表單送出後 React 會重設欄位）；PIN 不帶回 */
  values?: Record<string, string>;
}

const keepValues = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.flatMap((k) => (typeof fd.get(k) === "string" ? [[k, fd.get(k) as string]] : [])));
const CHILD_KEYS = ["displayName", "ageBand", "avatarKey"];

function toFormState(error: unknown): FormState {
  if (error instanceof AppError) {
    // 有欄位錯誤時，訊息顯示在各欄位旁邊；上方只提示「請看下面」，不重複同一句話
    if (error.issues.some((i) => i.field !== "_")) {
      return { error: "有些欄位需要修改，請看下面的提示", fieldErrors: Object.fromEntries(error.issues.map((i) => [i.field, i.message])) };
    }
    return { error: error.message };
  }
  logError(error);
  return { error: "系統發生錯誤，請稍後再試" };
}

async function sessionOrRedirect() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
};

const childFromForm = (fd: FormData, prefix = "") => ({
  displayName: text(fd, `${prefix}displayName`),
  ageBand: text(fd, `${prefix}ageBand`),
  avatarKey: text(fd, `${prefix}avatarKey`),
});

// ---------------------------------------------------------------------------
// 登入
// ---------------------------------------------------------------------------

export async function loginLocalAction(formData: FormData): Promise<void> {
  if (!isLocalMode()) redirect("/login");
  const user = LOCAL_USERS.find((u) => u.key === text(formData, "user"));
  if (!user) redirect("/login");
  (await cookies()).set(LOCAL_SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  await grantParentMode(user.id);
  redirect("/");
}

const credentialsSchema = z.object({
  email: z.email("請輸入有效的 Email"),
  password: z.string().min(8, "密碼至少 8 個字元").max(72, "密碼最多 72 個字元"),
});

export async function loginSupabaseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const supabase = await createSupabaseServerClient();
  let userId: string | undefined;
  if (text(formData, "intent") === "signup") {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (error) return { error: `註冊失敗：${error.message}` };
    if (!data.session) return { done: true };
    userId = data.user?.id;
  } else {
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Email 或密碼不正確" };
    userId = data.user.id;
  }
  // 用密碼登入就是家長本人
  if (userId) await grantParentMode(userId);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const user = await sessionOrRedirect();
  // 只有家長模式能登出，避免孩子把家長的帳號登出
  if (!(await readPlayMode(user.id)).parentUnlocked) redirect("/family/unlock");
  await clearModes();
  if (isLocalMode()) {
    (await cookies()).delete(LOCAL_SESSION_COOKIE);
  } else {
    await (await createSupabaseServerClient()).auth.signOut();
  }
  redirect("/login");
}

// ---------------------------------------------------------------------------
// 家庭與孩子
// ---------------------------------------------------------------------------

export async function setupFamilyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await sessionOrRedirect();
  try {
    await setupFamily(await getDb(), user.id, {
      familyName: text(formData, "familyName"),
      parentName: text(formData, "parentName"),
      pin: text(formData, "pin"),
      pinConfirm: text(formData, "pinConfirm"),
      child: childFromForm(formData, "child."),
    });
  } catch (error) {
    return { ...toFormState(error), values: keepValues(formData, ["familyName", "parentName", ...CHILD_KEYS.map((k) => `child.${k}`)]) };
  }
  // 剛設定好 PIN 的就是家長本人
  await grantParentMode(user.id);
  redirect("/family");
}

export async function addChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await sessionOrRedirect();
  if (!(await readPlayMode(user.id)).parentUnlocked) redirect("/family/unlock");
  try {
    await addChild(await getDb(), user.id, childFromForm(formData));
  } catch (error) {
    return { ...toFormState(error), values: keepValues(formData, CHILD_KEYS) };
  }
  revalidatePath("/family");
  return { done: true };
}

// ---------------------------------------------------------------------------
// 家長模式／孩子模式
// ---------------------------------------------------------------------------

/** 選一位孩子開始玩：孩子一定要屬於這個家庭 */
export async function startPlayingAction(formData: FormData): Promise<void> {
  const user = await sessionOrRedirect();
  const childId = text(formData, "childId") ?? "";
  let kids;
  try {
    kids = await listChildren(await getDb(), user.id);
  } catch {
    redirect("/");
  }
  if (!kids.some((k) => k.id === childId)) redirect("/");
  await enterKidMode(user.id, childId);
  redirect("/play");
}

export async function switchPlayerAction(): Promise<void> {
  await sessionOrRedirect();
  await leaveKidMode();
  redirect("/");
}

export async function unlockParentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await sessionOrRedirect();
  let result;
  try {
    result = await checkParentPin(await getDb(), user.id, text(formData, "pin"));
  } catch (error) {
    return toFormState(error);
  }
  if (!result.ok) {
    if (result.lockedUntil) {
      const until = new Date(result.lockedUntil).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
      return { error: `輸錯太多次了，請在 ${until} 之後再試` };
    }
    return { error: `PIN 不正確，還可以再試 ${result.attemptsLeft} 次` };
  }
  await grantParentMode(user.id);
  redirect("/family");
}
