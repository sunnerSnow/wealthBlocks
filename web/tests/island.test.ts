import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { AppError } from "@/lib/errors";
import { getGameState } from "@/lib/services/game";
import { getIsland, moveObject, placeObject, storeObject } from "@/lib/services/island";
import { createFamily, createTestDb } from "./helpers/db";

let db: Db;
let fam: Awaited<ReturnType<typeof createFamily>>;

beforeEach(async () => {
  db = await createTestDb();
  fam = await createFamily(db);
});

const island = () => getIsland(db, fam.userId, fam.childId);
const qty = async (slug: string) => (await island()).inventory.find((i) => i.slug === slug)?.quantity ?? 0;
const objectOf = async (slug: string) => (await island()).objects.find((o) => o.slug === slug)!;

async function expectCode(p: Promise<unknown>, code: string) {
  const error = await p.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

describe("放置", () => {
  it("從收藏放到島上：收藏少一件、島上多一件，重新讀取仍在原位", async () => {
    const after = await placeObject(db, fam.userId, fam.childId, { slug: "tree", x: 5, y: 2 });
    expect(after.objects.some((o) => o.slug === "tree" && o.x === 5 && o.y === 2)).toBe(true);
    expect(after.inventory.find((i) => i.slug === "tree")).toBeUndefined();
    const state = await getGameState(db, fam.userId, fam.childId);
    expect(state.island.find((o) => o.slug === "tree")).toMatchObject({ x: 5, y: 2, source: "商店" });
  });

  it("放在水上、超出格線或和別的物件重疊都會被擋下", async () => {
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "flower", x: 0, y: 0 }), "placement_outside");
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "flower", x: 9, y: 4 }), "validation_failed");
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "flower", x: 3, y: 3 }), "placement_overlap");
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "flower", x: 1.5, y: 3 }), "validation_failed");
    expect(await qty("flower")).toBe(2);
  });

  it("收藏裡沒有的東西不能放（包括還沒擁有的建築與島嶼原有的岩石）", async () => {
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "shop", x: 4, y: 4 }), "not_in_inventory");
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "rock", x: 4, y: 4 }), "not_in_inventory");
    await expectCode(placeObject(db, fam.userId, fam.childId, { slug: "nope", x: 4, y: 4 }), "not_in_inventory");
  });

  it("用完就不能再放；同時送出兩次也只會放一次", async () => {
    await Promise.all([
      placeObject(db, fam.userId, fam.childId, { slug: "tree", x: 5, y: 2 }).catch((e) => e),
      placeObject(db, fam.userId, fam.childId, { slug: "tree", x: 6, y: 2 }).catch((e) => e),
    ]);
    const trees = (await island()).objects.filter((o) => o.slug === "tree");
    expect(trees).toHaveLength(1);
    expect(await qty("tree")).toBe(0);
  });
});

describe("移動與收回", () => {
  it("移動到空地；不能移到水上或疊在別的物件上；移動不花積木幣", async () => {
    const tent = await objectOf("tent");
    const before = (await getGameState(db, fam.userId, fam.childId)).balance;
    await moveObject(db, fam.userId, fam.childId, tent.id, { x: 5, y: 5 });
    expect(await objectOf("tent")).toMatchObject({ x: 5, y: 5 });
    // 原地不動也可以（忽略自己）
    await moveObject(db, fam.userId, fam.childId, tent.id, { x: 5, y: 5 });
    await expectCode(moveObject(db, fam.userId, fam.childId, tent.id, { x: 8, y: 8 }), "placement_outside");
    await expectCode(moveObject(db, fam.userId, fam.childId, tent.id, { x: 7, y: 4 }), "placement_overlap");
    expect((await getGameState(db, fam.userId, fam.childId)).balance).toBe(before);
  });

  it("島嶼原有的岩石不能移動也不能收回", async () => {
    const rock = await objectOf("rock");
    await expectCode(moveObject(db, fam.userId, fam.childId, rock.id, { x: 4, y: 4 }), "not_movable");
    await expectCode(storeObject(db, fam.userId, fam.childId, rock.id), "not_movable");
  });

  it("收回：島上少一件、收藏多一件（原本收藏沒有這一項也可以）", async () => {
    const tent = await objectOf("tent");
    const after = await storeObject(db, fam.userId, fam.childId, tent.id);
    expect(after.objects.some((o) => o.slug === "tent")).toBe(false);
    expect(await qty("tent")).toBe(1);
    await placeObject(db, fam.userId, fam.childId, { slug: "tent", x: 4, y: 4 });
    const placed = await objectOf("tent");
    await storeObject(db, fam.userId, fam.childId, placed.id);
    // 收藏列已存在（數量 0）時改用累加
    expect(await qty("tent")).toBe(1);
  });
});

describe("跨家庭", () => {
  it("不能動別的家庭孩子的島，也不能把東西放到別人的島上", async () => {
    const lin = await createFamily(db, { familyName: "林家", child: { displayName: "阿哲", ageBand: "11-12", avatarKey: "mint" } });
    const tent = await objectOf("tent");
    await expectCode(moveObject(db, lin.userId, lin.childId, tent.id, { x: 5, y: 5 }), "not_found");
    await expectCode(storeObject(db, lin.userId, lin.childId, tent.id), "not_found");
    await expectCode(placeObject(db, lin.userId, fam.childId, { slug: "tree", x: 5, y: 2 }), "not_found");
    expect(await objectOf("tent")).toMatchObject({ x: 3, y: 3 });
  });
});
