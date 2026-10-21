import { randomUUID } from "node:crypto";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import { PIN, cellCenter, expectCoins, loginAndSetup } from "./helpers";

/**
 * 手機上的完整流程（規格 15 的完成定義）：建立家庭 → 理財任務 → 商店 → 儲蓄目標 → 建造 → 帳本 → 家長中心。
 * 同一個孩子一路玩下去，所以整個檔案依序執行、共用同一個頁面。
 */
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page = await context.newPage();
  page.on("pageerror", (e) => {
    throw e;
  });
});

test.afterAll(async () => {
  await context.close();
});

test("建立家庭與遊戲檔案，孩子模式進不了家長區", async () => {
  await loginAndSetup(page, "A", "陳家", "小安");
  await page.getByRole("button", { name: "開始玩" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expectCoins(page, 100);
  await page.goto("/family");
  await expect(page).toHaveURL(/\/family\/unlock$/);
  await page.goto("/play");
});

test("完成三個理財任務、領取獎勵並升級；重玩不再發獎勵", async () => {
  await page.goto("/play/quests/toy-store");
  await page.locator(".opt", { hasText: "暫時不買" }).click();
  await page.getByRole("button", { name: "就選這個" }).click();
  await expect(page.locator(".recap")).toContainText("暫時不買");
  await page.getByRole("button", { name: /領取獎勵/ }).click();
  await expect(page.locator(".toast")).toContainText("+10 積木幣");
  await expectCoins(page, 110);

  await page.goto("/play/quests/toy-store");
  await page.locator(".opt", { hasText: "買下玩具車" }).click();
  await page.getByRole("button", { name: "就選這個" }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("之前已經領過");
  await expectCoins(page, 110);

  await page.goto("/play/quests/bakery-helper");
  await page.locator(".opt", { hasText: "設計新招牌" }).click();
  await page.getByRole("button", { name: "就選這個" }).click();
  await page.getByRole("button", { name: /領取獎勵/ }).click();
  await expectCoins(page, 125);

  await page.goto("/play/quests/three-jars");
  for (const [jar, times] of [["花用", 3], ["儲蓄", 5], ["分享", 2]] as const) {
    for (let i = 0; i < times; i++) await page.getByRole("button", { name: `${jar}罐增加 5` }).click();
  }
  await page.getByRole("button", { name: "完成分配" }).click();
  await page.getByRole("button", { name: /領取獎勵/ }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("小小建築師");
  await expect(dialog).toContainText("圖書館");
  await dialog.getByRole("button", { name: "太好了" }).click();
  await expectCoins(page, 140);
});

test("同一個請求重送不會重複發獎勵或重複扣款", async () => {
  const requestId = randomUUID();
  const send = () => page.request.post("/api/shop/purchase", { data: { slug: "road", requestId } });
  const [first, second] = [await send(), await send()];
  expect(first.status()).toBe(200);
  expect((await second.json()).data.replayed).toBe(true);
  const again = await page.request.post("/api/quests/bakery-helper/complete", { data: { choice: "A", requestId: randomUUID() } });
  expect((await again.json()).data.rewarded).toBe(false);
  await page.reload();
  await expectCoins(page, 135);
});

test("商店：買三種商品；錢不夠時提示差多少並可以設成目標", async () => {
  await page.getByRole("link", { name: "商店" }).last().click();
  for (const name of ["路燈", "花圃"]) {
    await page.locator(".scard", { hasText: name }).click();
    await expect(page.locator(".think")).toContainText("需要");
    await page.getByRole("button", { name: /確認購買/ }).click();
    await expect(page.locator(".toast")).toContainText(`買好了「${name}」`);
  }
  await expectCoins(page, 95);
  await page.locator(".scard", { hasText: "小商店" }).click();
  await expect(page.locator(".warn")).toContainText("還差 25 積木幣");
  await page.locator("dialog[open]").getByRole("button", { name: "關閉" }).click();
});

test("儲蓄目標：建立、存入、取回；存滿解鎖建築", async () => {
  await page.getByRole("link", { name: "目標" }).last().click();
  await page.getByRole("button", { name: "新增目標" }).click();
  await page.locator("dialog[open] .pick", { hasText: "小湖泊" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "建立目標" }).click();
  const card = page.locator(".gcard", { hasText: "小湖泊" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "存入" }).click();
  await page.locator("dialog[open] .chip", { hasText: /^20$/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "存入 20 積木幣" }).click();
  await expectCoins(page, 75);
  await card.getByRole("button", { name: "取回" }).click();
  await page.locator("dialog[open] .chip", { hasText: /^10$/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "取回 10 積木幣" }).click();
  await expectCoins(page, 85);

  await card.getByRole("button", { name: "存入" }).click();
  await page.locator("dialog[open] .chip", { hasText: "剛好補滿 50" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "存入 50 積木幣" }).click();
  await expect(page.locator("dialog[open]")).toContainText("目標達成");
  await page.locator("dialog[open]").getByRole("link", { name: "放到島上" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expectCoins(page, 35);
});

test("建造：放置、移動建築，重新整理後位置還在", async () => {
  await page.locator("button.fab").click();
  await page.locator(".ichip", { hasText: "小湖泊" }).click();
  await expect(page.locator(".tray-status.ok")).toBeVisible();
  await page.getByRole("button", { name: "放在這裡" }).click();
  await expect(page.locator(".toast")).toContainText("放好了「小湖泊」");

  // 花圃點水面會被擋下，點兩下空地才放下
  await page.locator(".ichip", { hasText: "花圃" }).click();
  const water = await cellCenter(page, 0, 0);
  await page.touchscreen.tap(water.x, water.y);
  await expect(page.locator(".tray-status.bad")).toContainText("超出島嶼範圍");
  const spot = await cellCenter(page, 5, 1);
  await page.touchscreen.tap(spot.x, spot.y);
  await expect(page.locator(".tray-status.ok")).toBeVisible();
  await page.touchscreen.tap(spot.x, spot.y);
  await expect(page.locator(".toast")).toContainText("放好了「花圃」");
  // 花圃還有剩，仍在放置模式；先取消才能點選島上的作品
  await page.getByRole("button", { name: "取消" }).click();

  // 帳篷用鍵盤移動
  await page.locator(".obj[aria-label^='起點帳篷']").click({ force: true });
  await page.getByRole("button", { name: "移動", exact: true }).click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast")).toContainText("移好了");
  await page.locator("button.fab").click();

  await page.reload();
  await expect(page.locator(".obj[aria-label='花圃，第 2 列第 6 格']")).toHaveCount(1);
  await expect(page.locator(".obj[aria-label='起點帳篷，第 4 列第 2 格']")).toHaveCount(1);
  await expect(page.locator(".obj[aria-label^='小湖泊']")).toHaveCount(1);
});

test("帳本：每一筆都記下來，最後一筆的餘額等於目前積木幣", async () => {
  await page.goto("/play/ledger");
  const rows = await page.request.get("/api/wallet/transactions").then((r) => r.json());
  const list = rows.data as { amount: number; balanceAfter: number }[];
  expect(list.reduce((n, t) => n + t.amount, 0)).toBe(list[0].balanceAfter);
  expect(list[0].balanceAfter).toBe(35);
  await expect(page.locator(".kid-main .tx-list li")).toHaveCount(list.length);
});

test("家長中心：輸入 PIN、看學習進度、設定零用錢與權限", async () => {
  await page.goto("/play/me");
  await page.getByRole("button", { name: "換人玩" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "家長區" }).click();
  await page.locator("input[name=pin]").fill("0000");
  await page.getByRole("button", { name: "進入家長區" }).click();
  await expect(page.locator(".alert")).toContainText("還可以再試 4 次");
  await page.locator("input[name=pin]").fill(PIN);
  await page.getByRole("button", { name: "進入家長區" }).click();
  await expect(page).toHaveURL(/\/family$/);

  await page.getByRole("link", { name: "學習進度" }).click();
  await expect(page.locator(".log-list")).toContainText("零用錢分三罐");
  await expect(page.locator(".prompt-list li")).toHaveCount(3);

  await page.locator("label.switch-row", { hasText: "定期發虛擬零用錢" }).locator("input").check();
  await page.locator("label.tile", { hasText: "週六" }).click();
  await page.locator("label.switch-row", { hasText: "自己設定儲蓄目標" }).locator("input").uncheck();
  await page.getByRole("button", { name: "儲存設定" }).click();
  await expect(page.locator(".success", { hasText: "設定已儲存" })).toBeVisible();
  await expect(page.locator(".change-log")).toContainText("孩子自己設定目標：開 → 關");
  await page.reload();
  await expect(page.locator("label.switch-row", { hasText: "定期發虛擬零用錢" }).locator("input")).toBeChecked();
  await expect(page.locator("section", { hasText: "虛擬零用錢與權限" }).first()).toContainText("下一次發放");
});
