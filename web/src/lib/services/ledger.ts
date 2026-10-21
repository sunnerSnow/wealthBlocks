import { and, desc, eq } from "drizzle-orm";
import { type ReferenceType, type TxType, virtualTransactions, virtualWallets } from "@/lib/db/schema";
import type { Tx } from "@/lib/db/with-user";
import { AppError, notFound } from "@/lib/errors";

/** 與資料庫的 check 相同：收入類型一定是正數、支出類型一定是負數 */
const INCOME: readonly TxType[] = ["initial_grant", "allowance", "quest_reward", "goal_withdrawal"];
const EXPENSE: readonly TxType[] = ["purchase", "goal_contribution"];

export interface PostTxInput {
  familyId: string;
  walletId: string;
  type: TxType;
  amount: number;
  /** 同一個錢包內唯一；同一個操作重送時要帶一樣的值 */
  idempotencyKey: string;
  description: string;
  referenceType?: ReferenceType;
  referenceId?: string;
}

export interface TxDto {
  id: string;
  type: TxType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface PostTxResult {
  transaction: TxDto;
  /** true：這個 idempotencyKey 之前已經處理過，這次沒有再動到餘額 */
  replayed: boolean;
}

const toDto = (row: typeof virtualTransactions.$inferSelect): TxDto => ({
  id: row.id,
  type: row.type,
  amount: row.amount,
  balanceAfter: row.balanceAfter,
  description: row.description,
  createdAt: row.createdAt,
});

/**
 * 記一筆積木幣變動：鎖住錢包 → 檢查是否重送 → 檢查餘額 → 新增帳本 → 更新餘額快照。
 * 必須在呼叫端的資料庫交易內執行，跟其他相關資料（購買紀錄、目標金額…）一起成功或一起失敗。
 */
export async function postVirtualTransaction(tx: Tx, input: PostTxInput): Promise<PostTxResult> {
  const { amount, type } = input;
  if (!Number.isSafeInteger(amount) || amount === 0) throw new AppError("invalid_amount", "積木幣數量必須是不為 0 的整數", 400);
  if ((INCOME.includes(type) && amount < 0) || (EXPENSE.includes(type) && amount > 0)) {
    throw new AppError("invalid_amount", "這種交易的正負號不對", 400);
  }

  const [wallet] = await tx
    .select({ id: virtualWallets.id, balance: virtualWallets.balance })
    .from(virtualWallets)
    .where(and(eq(virtualWallets.id, input.walletId), eq(virtualWallets.familyId, input.familyId)))
    .for("update");
  if (!wallet) throw notFound("錢包");

  const [existing] = await tx
    .select()
    .from(virtualTransactions)
    .where(and(eq(virtualTransactions.walletId, wallet.id), eq(virtualTransactions.idempotencyKey, input.idempotencyKey)));
  if (existing) {
    if (existing.type !== type || existing.amount !== amount) {
      throw new AppError("idempotency_conflict", "這個請求編號已經用在另一筆交易", 409);
    }
    return { transaction: toDto(existing), replayed: true };
  }

  const balanceAfter = wallet.balance + amount;
  if (balanceAfter < 0) throw new AppError("insufficient_balance", `積木幣不夠，還差 ${-balanceAfter}`, 409);

  const [row] = await tx
    .insert(virtualTransactions)
    .values({
      familyId: input.familyId,
      walletId: wallet.id,
      type,
      amount,
      balanceAfter,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
    })
    .returning();
  await tx.update(virtualWallets).set({ balance: balanceAfter }).where(eq(virtualWallets.id, wallet.id));
  return { transaction: toDto(row), replayed: false };
}

export async function listTransactionsForWallet(tx: Tx, familyId: string, walletId: string, limit = 50): Promise<TxDto[]> {
  const rows = await tx
    .select()
    .from(virtualTransactions)
    .where(and(eq(virtualTransactions.walletId, walletId), eq(virtualTransactions.familyId, familyId)))
    .orderBy(desc(virtualTransactions.seq))
    .limit(limit);
  return rows.map(toDto);
}
