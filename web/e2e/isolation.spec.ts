import { expect, test } from "@playwright/test";
import { loginAndSetup } from "./helpers";

/**
 * 權限與資料隔離（規格 13.1）：家長 B 看不到別人的資料；cookie 綁定帳號，偽造或拿去別的帳號都沒用；
 * 孩子模式不能用家長 API；未登入的 API 回 401。
 */
test.use({ viewport: { width: 1280, height: 900 } });

test("未登入：頁面導向登入、API 回 401", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/login$/);
  const res = await page.request.get("/api/game/state");
  expect(res.status()).toBe(401);
});

test("別的家庭的資料讀不到，模式 cookie 不能偽造", async ({ page, context }) => {
  await loginAndSetup(page, "B", "林家", "阿哲");
  await expect(page.locator(".kid-row")).toHaveCount(1);

  // 不存在或別人的孩子一律 404，不透露是否存在
  const other = await page.request.get("/api/parent/progress?childId=00000000-0000-4000-8000-000000000000");
  expect(other.status()).toBe(404);

  // 偽造的孩子模式 cookie 無效：仍然沒有正在玩的孩子
  await context.addCookies([{ name: "wb_kid", value: "k:someone:child.fakesignature", domain: "localhost", path: "/" }]);
  const state = await page.request.get("/api/game/state");
  expect(state.status()).toBe(409);

  // 孩子模式不能用家長 API
  await page.getByRole("button", { name: "開始玩" }).click();
  await expect(page).toHaveURL(/\/play$/);
  const childId = (await (await page.request.get("/api/game/state")).json()).data.child.id;
  const parentApi = await page.request.get(`/api/parent/progress?childId=${childId}`);
  expect(parentApi.status()).toBe(403);

  // 跨站送出的寫入請求會被拒絕
  const forged = await page.request.post("/api/shop/purchase", {
    headers: { origin: "https://evil.example" },
    data: { slug: "tree", requestId: "00000000-0000-4000-8000-000000000001" },
  });
  expect(forged.status()).toBe(403);
});
