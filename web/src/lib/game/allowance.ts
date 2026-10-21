/**
 * 虛擬零用錢的發放時間（純計算，方便測試）。
 * 台灣沒有日光節約時間，所以「台北時間 08:00」固定是 UTC 00:00。
 */
const DAY = 24 * 60 * 60 * 1000;
const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
const PAY_HOUR = 8;

/** 很久沒打開遊戲時，最多補發幾期 */
export const MAX_CATCH_UP = 4;

export const WEEKDAY_LABEL = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

/** 啟用（或改了發放日、間隔）時的第 0 期：從 now 之後最近的一個 weekday 台北時間 08:00 */
export function firstPayday(now: Date, weekday: number): Date {
  const local = now.getTime() + TAIPEI_OFFSET;
  const midnight = Math.floor(local / DAY) * DAY;
  const today = new Date(midnight).getUTCDay();
  let target = midnight + ((weekday - today + 7) % 7) * DAY + PAY_HOUR * 60 * 60 * 1000;
  if (target <= local) target += 7 * DAY;
  return new Date(target - TAIPEI_OFFSET);
}

/** 到 now 為止、還沒發的期數（由小到大）；最多補發 MAX_CATCH_UP 期 */
export function duePeriods(anchor: Date, intervalDays: number, now: Date, lastPaid: number): number[] {
  const elapsed = now.getTime() - anchor.getTime();
  if (elapsed < 0) return [];
  const current = Math.floor(elapsed / (intervalDays * DAY));
  const from = Math.max(lastPaid + 1, current - MAX_CATCH_UP + 1, 0);
  const periods: number[] = [];
  for (let p = from; p <= current; p++) periods.push(p);
  return periods;
}

/** 下一次發放時間 */
export function nextPayday(anchor: Date, intervalDays: number, now: Date): Date {
  const elapsed = now.getTime() - anchor.getTime();
  if (elapsed < 0) return anchor;
  const interval = intervalDays * DAY;
  return new Date(anchor.getTime() + (Math.floor(elapsed / interval) + 1) * interval);
}

export const allowanceKey = (anchor: Date, period: number) => `allowance:${anchor.getTime()}:${period}`;
