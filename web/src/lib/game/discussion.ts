import type { QuestCategory } from "@/lib/game/quests";

/**
 * 親子討論題目（規格 6.3）：內建題庫，不需要生成式 AI。
 * 先放孩子最近玩過的任務思考題，再依日期輪替補上一般題目，同一天看到的題目固定。
 */
const GENERAL = [
  "如果這個月只能選一個願望，你會怎麼決定？",
  "為什麼有些東西現在買比較好，有些可以等一等？",
  "如果計畫改變了，我們可以怎麼調整？",
  "你覺得「需要」和「想要」有什麼不一樣？可以各舉一個例子嗎？",
  "存錢的時候，什麼事情會讓你想放棄？我們可以怎麼幫忙？",
  "如果有一筆意外的零用錢，你會怎麼分配？",
  "你最近有沒有幫助別人？那時候的感覺是什麼？",
  "家裡買東西之前，大人通常會想哪些事情？",
] as const;

const BY_CATEGORY: Record<QuestCategory, string> = {
  earn: "你覺得做哪些事情可以賺到收入？哪一種你最想試試看？",
  spend: "最近有沒有很想買的東西？我們一起想想它是需要還是想要。",
  save: "如果要存錢買一個大目標，每週存多少比較剛好？",
  plan: "零用錢分成花用、儲蓄、分享三份，你覺得怎麼分最適合你？",
  share: "幫助別人的時候，除了錢，還可以付出什麼？",
  risk: "有些選擇結果很確定、有些可能大成功也可能失敗，你比較喜歡哪一種？為什麼？",
};

export function discussionPrompts(recent: { reflect: string; category: QuestCategory }[], today: Date, count = 3): string[] {
  const picked: string[] = [];
  const add = (q: string) => {
    if (q && !picked.includes(q) && picked.length < count) picked.push(q);
  };
  for (const r of recent.slice(0, 2)) add(r.reflect);
  if (recent[0]) add(BY_CATEGORY[recent[0].category]);
  const day = Math.floor(today.getTime() / 86_400_000);
  for (let i = 0; picked.length < count && i < GENERAL.length; i++) add(GENERAL[(day + i) % GENERAL.length]);
  return picked;
}
