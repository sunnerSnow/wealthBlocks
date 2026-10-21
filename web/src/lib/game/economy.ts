/** 遊戲經濟的固定設定（只在伺服器使用；前端不能指定任何金額） */

/** 建立遊戲檔案時發給孩子的初始積木幣 */
export const INITIAL_GRANT = 100;

/** 新島嶼上的起始物件：帳篷是新手禮包，岩石是島嶼原有（不能移動） */
export const STARTER_OBJECTS = [
  { slug: "tent", x: 3, y: 3 },
  { slug: "rock", x: 7, y: 4 },
  { slug: "rock", x: 1, y: 6 },
] as const;

/** 新手禮包放在收藏裡、等孩子自己放上島的物件 */
export const STARTER_INVENTORY = [
  { slug: "tree", quantity: 1 },
  { slug: "flower", quantity: 2 },
  { slug: "road", quantity: 4 },
] as const;

/** 一個家庭最多幾位孩子 */
export const MAX_CHILDREN = 6;

export const initialGrantKey = (gameProfileId: string) => `initial-grant:${gameProfileId}`;
