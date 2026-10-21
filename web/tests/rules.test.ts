import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth/pin";
import { childIdFromKidToken, isParentTokenValid, kidToken, parentToken } from "@/lib/auth/mode-token";
import { STARTER_OBJECTS } from "@/lib/game/economy";
import { familySetupSchema, isWeakPin } from "@/lib/game/input";
import { checkPlacement, isLand } from "@/lib/game/island";
import { levelForXp, xpProgress } from "@/lib/game/levels";

describe("等級", () => {
  it("依累計經驗值計算等級與進度", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(700)).toBe(5);
    expect(levelForXp(1000)).toBe(6);
    expect(xpProgress(105)).toMatchObject({ level: 2, title: "小小建築師", current: 5, needed: 150, percent: 3 });
  });

  it("拒絕負數或小數的經驗值", () => {
    expect(() => levelForXp(-1)).toThrow();
    expect(() => levelForXp(1.5)).toThrow();
  });
});

describe("島嶼放置規則", () => {
  const placed = [{ id: "tent", x: 3, y: 3, width: 1, height: 1 }];

  it("只能放在陸地上", () => {
    expect(isLand(0, 0)).toBe(false);
    expect(isLand(4, 4)).toBe(true);
    expect(checkPlacement({ x: 0, y: 0, width: 1, height: 1 }, placed)).toEqual({ ok: false, reason: "outside" });
    // 2×2 的右下角超出陸地
    expect(checkPlacement({ x: 7, y: 5, width: 2, height: 2 }, placed)).toEqual({ ok: false, reason: "outside" });
    expect(checkPlacement({ x: 8, y: 8, width: 2, height: 2 }, placed)).toEqual({ ok: false, reason: "outside" });
  });

  it("不能和其他物件重疊；移動時忽略自己", () => {
    expect(checkPlacement({ x: 2, y: 2, width: 2, height: 2 }, placed)).toEqual({ ok: false, reason: "overlap", withId: "tent" });
    expect(checkPlacement({ x: 3, y: 3, width: 1, height: 1 }, placed, "tent")).toEqual({ ok: true });
    expect(checkPlacement({ x: 4, y: 4, width: 2, height: 2 }, placed)).toEqual({ ok: true });
  });

  it("新島嶼的起始物件都放在合法位置", () => {
    const done: { id: string; x: number; y: number; width: number; height: number }[] = [];
    for (const [i, o] of STARTER_OBJECTS.entries()) {
      const fp = { id: String(i), x: o.x, y: o.y, width: 1, height: 1 };
      expect(checkPlacement(fp, done)).toEqual({ ok: true });
      done.push(fp);
    }
  });
});

describe("家長 PIN", () => {
  it("雜湊後可以驗證，錯的 PIN 不通過", async () => {
    const stored = await hashPin("2580");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("2580");
    expect(await verifyPin("2580", stored)).toBe(true);
    expect(await verifyPin("2581", stored)).toBe(false);
    expect(await verifyPin("2580", "garbage")).toBe(false);
  });

  it("太好猜的 PIN 與兩次不一致都會被擋下", () => {
    expect(isWeakPin("1111")).toBe(true);
    expect(isWeakPin("1234")).toBe(true);
    expect(isWeakPin("9876")).toBe(true);
    expect(isWeakPin("2580")).toBe(false);
    const base = { familyName: "陳家", parentName: "媽媽", child: { displayName: "小安", ageBand: "9-10" } };
    expect(familySetupSchema.safeParse({ ...base, pin: "1234", pinConfirm: "1234" }).success).toBe(false);
    expect(familySetupSchema.safeParse({ ...base, pin: "2580", pinConfirm: "2581" }).success).toBe(false);
    expect(familySetupSchema.safeParse({ ...base, pin: "25a0", pinConfirm: "25a0" }).success).toBe(false);
    expect(familySetupSchema.safeParse({ ...base, pin: "2580", pinConfirm: "2580" }).success).toBe(true);
  });
});

describe("模式 cookie", () => {
  const secret = "test-secret-test-secret-test-secret!";
  const user = "00000000-0000-4000-8000-0000000000a1";
  const other = "00000000-0000-4000-8000-0000000000b1";

  it("家長模式會過期，也不能拿到別的帳號用", () => {
    const token = parentToken(user, 1000, secret);
    expect(isParentTokenValid(token, user, 999, secret)).toBe(true);
    expect(isParentTokenValid(token, user, 1000, secret)).toBe(false);
    expect(isParentTokenValid(token, other, 999, secret)).toBe(false);
    expect(isParentTokenValid(undefined, user, 999, secret)).toBe(false);
  });

  it("竄改內容或用別的密鑰都會失效", () => {
    const token = kidToken(user, "child-1", secret);
    expect(childIdFromKidToken(token, user, secret)).toBe("child-1");
    expect(childIdFromKidToken(token.replace("child-1", "child-2"), user, secret)).toBeNull();
    expect(childIdFromKidToken(token, user, `${secret}x`)).toBeNull();
    expect(childIdFromKidToken(token, other, secret)).toBeNull();
    // 孩子模式的 cookie 不能當成家長模式
    expect(isParentTokenValid(token, user, 0, secret)).toBe(false);
  });
});
