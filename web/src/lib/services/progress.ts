import type { Db } from "@/lib/db/local";
import { discussionPrompts } from "@/lib/game/discussion";
import { CATEGORY_LABEL, type QuestCategory } from "@/lib/game/quests";
import { type GameStateDto, getChildLedger, getGameState } from "@/lib/services/game";
import { type GoalsDto, listGoals } from "@/lib/services/goals";
import type { TxDto } from "@/lib/services/ledger";
import { type LearningLogDto, listLearningLog, listQuests } from "@/lib/services/quests";
import { type ChildSettingsDto, type SettingsLogDto, getChildSettings, listSettingsLog, settleAllowance } from "@/lib/services/settings";

export interface ChildProgressDto {
  child: GameStateDto["child"];
  progress: GameStateDto["progress"];
  balance: number;
  quests: {
    done: number;
    total: number;
    /** 接觸過的理財主題（完成過至少一個任務的分類） */
    topics: { category: QuestCategory; label: string; done: boolean }[];
    recent: LearningLogDto[];
  };
  goals: GoalsDto;
  settings: ChildSettingsDto;
  settingsLog: SettingsLogDto[];
  recentTransactions: TxDto[];
  prompts: string[];
}

/**
 * 家長中心的學習進度（規格 6.1）：只看學了什麼、做了哪些選擇，不排名、不用積木幣多寡評價孩子。
 * 呼叫端要先確認是家長模式；孩子必須屬於這個家庭（否則 404）。
 */
export async function getChildProgress(db: Db, userId: string, childId: string, now = new Date()): Promise<ChildProgressDto> {
  await settleAllowance(db, userId, childId, now);
  const [state, quests, recent, goals, settings, settingsLog, ledger] = await Promise.all([
    getGameState(db, userId, childId),
    listQuests(db, userId, childId),
    listLearningLog(db, userId, childId, 8),
    listGoals(db, userId, childId),
    getChildSettings(db, userId, childId, now),
    listSettingsLog(db, userId, childId, 8),
    getChildLedger(db, userId, childId),
  ]);
  const doneCategories = new Set(quests.filter((q) => q.status === "done").map((q) => q.category));
  return {
    child: state.child,
    progress: state.progress,
    balance: state.balance,
    quests: {
      done: quests.filter((q) => q.status === "done").length,
      total: quests.length,
      topics: (Object.keys(CATEGORY_LABEL) as QuestCategory[]).map((category) => ({
        category,
        label: CATEGORY_LABEL[category],
        done: doneCategories.has(category),
      })),
      recent,
    },
    goals,
    settings,
    settingsLog,
    recentTransactions: ledger.transactions.slice(0, 10),
    prompts: discussionPrompts(recent, now),
  };
}
