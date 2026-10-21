import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 家長模式與孩子模式的 cookie 內容（HMAC 簽章，綁定登入的家長帳號）。
 * - 家長模式：登入或輸入 PIN 後取得，有效 PARENT_TTL_SECONDS；沒有它就進不了家長區。
 * - 孩子模式：記住這台裝置正在玩的孩子。
 * 兩者都不能被竄改成別的帳號或別的孩子；刪掉 cookie 只會回到「誰要來玩？」，不會變成家長。
 */
export const PARENT_COOKIE = "wb_parent";
export const KID_COOKIE = "wb_kid";
export const PARENT_TTL_SECONDS = 12 * 60 * 60;

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sign(payload: string, secret: string): string {
  return `${payload}.${mac(payload, secret)}`;
}

function verify(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(mac(payload, secret), "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? payload : null;
}

export function parentToken(userId: string, expiresAtSeconds: number, secret: string): string {
  return sign(`p:${userId}:${expiresAtSeconds}`, secret);
}

export function isParentTokenValid(token: string | undefined, userId: string, nowSeconds: number, secret: string): boolean {
  const payload = verify(token, secret);
  if (!payload) return false;
  const [kind, uid, exp] = payload.split(":");
  return kind === "p" && uid === userId && Number(exp) > nowSeconds;
}

export function kidToken(userId: string, childId: string, secret: string): string {
  return sign(`k:${userId}:${childId}`, secret);
}

export function childIdFromKidToken(token: string | undefined, userId: string, secret: string): string | null {
  const payload = verify(token, secret);
  if (!payload) return null;
  const [kind, uid, childId] = payload.split(":");
  return kind === "k" && uid === userId && childId ? childId : null;
}
