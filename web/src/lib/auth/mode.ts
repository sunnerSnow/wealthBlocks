import "server-only";
import { cookies } from "next/headers";
import { appSecret } from "@/lib/config";
import {
  KID_COOKIE,
  PARENT_COOKIE,
  PARENT_TTL_SECONDS,
  childIdFromKidToken,
  isParentTokenValid,
  kidToken,
  parentToken,
} from "@/lib/auth/mode-token";

export interface PlayMode {
  /** 這台裝置目前可以進家長區 */
  parentUnlocked: boolean;
  /** 這台裝置正在玩的孩子（尚未確認孩子是否還存在、是否屬於這個家庭） */
  kidChildId: string | null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

const baseOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export async function readPlayMode(userId: string): Promise<PlayMode> {
  const store = await cookies();
  const secret = appSecret();
  return {
    parentUnlocked: isParentTokenValid(store.get(PARENT_COOKIE)?.value, userId, nowSeconds(), secret),
    kidChildId: childIdFromKidToken(store.get(KID_COOKIE)?.value, userId, secret),
  };
}

/** 登入或輸入 PIN 後：進入家長模式（同時結束孩子模式） */
export async function grantParentMode(userId: string): Promise<void> {
  const store = await cookies();
  const expires = nowSeconds() + PARENT_TTL_SECONDS;
  store.set(PARENT_COOKIE, parentToken(userId, expires, appSecret()), { ...baseOptions(), maxAge: PARENT_TTL_SECONDS });
  store.delete(KID_COOKIE);
}

/** 交給孩子玩：結束家長模式，之後要回家長區得再輸入 PIN */
export async function enterKidMode(userId: string, childId: string): Promise<void> {
  const store = await cookies();
  store.set(KID_COOKIE, kidToken(userId, childId, appSecret()), { ...baseOptions(), maxAge: 60 * 60 * 24 * 30 });
  store.delete(PARENT_COOKIE);
}

export async function leaveKidMode(): Promise<void> {
  (await cookies()).delete(KID_COOKIE);
}

export async function clearModes(): Promise<void> {
  const store = await cookies();
  store.delete(KID_COOKIE);
  store.delete(PARENT_COOKIE);
}
