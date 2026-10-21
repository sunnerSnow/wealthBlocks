import { z } from "zod";

export const AGE_BANDS = ["6-8", "9-10", "11-12"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const AGE_BAND_LABEL: Record<AgeBand, string> = { "6-8": "6–8 歲", "9-10": "9–10 歲", "11-12": "11–12 歲" };

/** 頭像是積木人頭的顏色 */
export const AVATARS = ["sun", "mint", "peach", "sand"] as const;
export type AvatarKey = (typeof AVATARS)[number];

export const childInputSchema = z.object({
  displayName: z.string({ error: "請輸入暱稱" }).trim().min(1, "請輸入暱稱").max(12, "暱稱最多 12 個字"),
  ageBand: z.enum(AGE_BANDS, { error: "請選擇年齡區間" }),
  avatarKey: z.enum(AVATARS, { error: "請選擇頭像" }).default("sun"),
});
export type ChildInput = z.infer<typeof childInputSchema>;

/** 太好猜的 PIN：四個相同數字，或連續遞增／遞減 */
export function isWeakPin(pin: string): boolean {
  const d = [...pin].map(Number);
  const same = d.every((n) => n === d[0]);
  const up = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const down = d.every((n, i) => i === 0 || n === d[i - 1] - 1);
  return same || up || down;
}

export const pinSchema = z
  .string({ error: "請輸入 4 位數字的 PIN" })
  .regex(/^\d{4}$/, "PIN 要是 4 位數字");

export const familySetupSchema = z
  .object({
    familyName: z.string({ error: "請輸入家庭名稱" }).trim().min(1, "請輸入家庭名稱").max(20, "家庭名稱最多 20 個字"),
    parentName: z.string({ error: "請輸入你的稱呼" }).trim().min(1, "請輸入你的稱呼").max(20, "稱呼最多 20 個字"),
    pin: pinSchema.refine((p) => !isWeakPin(p), "這組 PIN 太好猜了，換一組吧"),
    pinConfirm: z.string({ error: "請再輸入一次 PIN" }),
    child: childInputSchema,
  })
  .refine((d) => d.pin === d.pinConfirm, { path: ["pinConfirm"], message: "兩次輸入的 PIN 不一樣" });
export type FamilySetupInput = z.infer<typeof familySetupSchema>;
