/** 各等級需要的「累計」經驗值；超過最後一級後每 300 點升一級 */
export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700] as const;
const AFTER_LAST = 300;

const TITLES = ["積木新手", "小小建築師", "島嶼規劃師", "理財設計師", "財富建築大師"];

export function levelTitle(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1];
}

function thresholdOf(level: number): number {
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * AFTER_LAST;
}

export function levelForXp(xp: number): number {
  if (!Number.isInteger(xp) || xp < 0) throw new Error("經驗值必須是非負整數");
  let level = 1;
  while (xp >= thresholdOf(level + 1)) level++;
  return level;
}

export interface XpProgress {
  level: number;
  title: string;
  /** 這一級已累積的經驗值 */
  current: number;
  /** 升到下一級需要的經驗值 */
  needed: number;
  percent: number;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const base = thresholdOf(level);
  const needed = thresholdOf(level + 1) - base;
  const current = xp - base;
  return { level, title: levelTitle(level), current, needed, percent: Math.floor((current / needed) * 100) };
}
