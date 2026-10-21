import { z } from "zod";

/**
 * 理財任務的內容格式（存在 quests.content_json，由 migration 維護）與結果計算。
 * 前端顯示結果與伺服器記錄結果用同一套計算，伺服器只相信自己算出來的。
 */

export const QUEST_CATEGORIES = ["earn", "spend", "save", "plan", "share", "risk"] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<QuestCategory, string> = {
  earn: "賺錢",
  spend: "消費",
  save: "儲蓄",
  plan: "規劃",
  share: "分享",
  risk: "風險",
};

const stat = z.object({ label: z.string(), value: z.union([z.number(), z.string()]), unit: z.string().optional() });
const option = z.object({
  key: z.string().regex(/^[A-D]$/),
  text: z.string(),
  hint: z.string(),
  stats: z.array(stat),
  goal: z.object({ saved: z.number(), target: z.number() }).optional(),
  pros: z.array(z.string()).min(1),
  cons: z.array(z.string()).min(1),
});
const common = {
  art: z.array(z.string()),
  story: z.array(z.string()).min(1),
  resources: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  ask: z.string(),
  reflect: z.string(),
};
export const questContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), ...common, options: z.array(option).min(2).max(4) }),
  z.object({
    kind: z.literal("alloc"),
    ...common,
    alloc: z.object({
      total: z.int().positive(),
      step: z.int().positive(),
      jars: z.array(z.object({ key: z.enum(["spend", "save", "share"]), label: z.string(), desc: z.string() })).length(3),
    }),
  }),
]);
export type QuestContent = z.infer<typeof questContentSchema>;
export type QuestStat = z.infer<typeof stat>;

export type Allocation = Record<"spend" | "save" | "share", number>;

/** 孩子送出的答案：選擇題送 choice；分配題送 alloc */
export const answerSchema = z.object({
  choice: z.string().optional(),
  alloc: z.object({ spend: z.int().min(0), save: z.int().min(0), share: z.int().min(0) }).optional(),
});
export type QuestAnswer = z.infer<typeof answerSchema>;

export interface QuestResult {
  /** 給孩子看、也存進學習紀錄的「你的選擇」 */
  label: string;
  stats: QuestStat[];
  goal?: { saved: number; target: number };
  alloc?: Allocation;
  pros: string[];
  cons: string[];
}

/** 驗證答案並算出結果；答案不合法回 null（例如選項不存在、分配加總不對、不是步長的倍數） */
export function questResult(content: QuestContent, answer: QuestAnswer): QuestResult | null {
  if (content.kind === "choice") {
    const o = content.options.find((x) => x.key === answer.choice);
    if (!o) return null;
    return { label: `${o.key}. ${o.text}`, stats: o.stats, goal: o.goal, pros: o.pros, cons: o.cons };
  }

  const a = answer.alloc;
  const { total, step } = content.alloc;
  if (!a || a.spend + a.save + a.share !== total || [a.spend, a.save, a.share].some((v) => v % step !== 0)) return null;
  const pros: string[] = [];
  const cons: string[] = [];
  const half = total / 2;
  if (a.save >= half) pros.push("一半以上存起來，為以後的大目標做準備。");
  if (a.spend >= half) pros.push("你重視現在就能享受的東西，這也很重要。");
  if (a.share > 0) pros.push("你留了一份給別人，分享也是管理金錢的一部分。");
  if (a.spend >= total / 5 && a.save >= total / 5 && a.share >= total / 5) pros.push("三個罐子都照顧到了，用起來很有彈性。");
  if (!pros.length) pros.push("你有自己的分配想法，試著說說看為什麼這樣分。");
  if (a.save === 0) cons.push("這次沒有存錢，遇到大目標時可能要花更久才能達成。");
  if (a.spend === 0) cons.push("花用罐是空的，這週想買小東西時要先想好怎麼辦。");
  if (a.share === 0) cons.push("這次沒有分享也沒關係，可以想想什麼時候會想幫助別人。");
  if (a.save > 0 && a.save < total * 0.3) cons.push("儲蓄罐比較少，存到大目標的速度會慢一些。");
  if (!cons.length) cons.push("分得很平均時，每一罐累積的速度都會慢一點。");
  const label = (k: keyof Allocation) => content.alloc.jars.find((j) => j.key === k)?.label ?? k;
  return {
    label: `${label("spend")} ${a.spend}、${label("save")} ${a.save}、${label("share")} ${a.share}`,
    stats: (["spend", "save", "share"] as const).map((k) => ({ label: `${label(k)}罐`, value: a[k], unit: "積木幣" })),
    alloc: a,
    pros,
    cons,
  };
}
