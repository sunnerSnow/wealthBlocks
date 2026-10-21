import { type Page, expect } from "@playwright/test";

export const PIN = "2580";

/** 以示範家長登入；第一次登入會建立家庭與第一位孩子 */
export async function loginAndSetup(page: Page, who: "A" | "B", family: string, child: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: `以示範家長 ${who}登入` }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.locator("input[name=familyName]").fill(family);
  await page.locator("input[name=parentName]").fill("媽媽");
  await page.locator("input[name=pin]").fill(PIN);
  await page.locator("input[name=pinConfirm]").fill(PIN);
  await page.locator("input[name='child.displayName']").fill(child);
  await page.getByRole("button", { name: "建立家庭與積木島" }).click();
  await expect(page).toHaveURL(/\/family$/);
}

export async function coins(page: Page): Promise<number> {
  return Number(await page.locator(".coinpill span").innerText());
}

export async function expectCoins(page: Page, value: number) {
  await expect(page.locator(".coinpill span")).toHaveText(String(value));
}

/** 島嶼格線上某一格的中心點（螢幕座標） */
export async function cellCenter(page: Page, x: number, y: number) {
  const box = await page.locator(".island-grid").boundingBox();
  if (!box) throw new Error("找不到島嶼格線");
  return { x: box.x + ((x + 0.5) * box.width) / 9, y: box.y + ((y + 0.5) * box.height) / 9 };
}
