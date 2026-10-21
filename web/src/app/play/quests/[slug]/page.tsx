import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireKid } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { getQuest } from "@/lib/services/quests";
import { QuestPlayer } from "./quest-player";

export const metadata: Metadata = { title: "理財任務" };

export default async function QuestPage({ params }: PageProps<"/play/quests/[slug]">) {
  const { db, user, state } = await requireKid();
  const { slug } = await params;
  let quest;
  try {
    quest = await getQuest(db, user.id, state.child.id, slug);
  } catch (error) {
    // 不存在或還沒解鎖：回到任務清單
    if (error instanceof AppError && (error.status === 404 || error.code === "quest_locked")) redirect("/play/quests");
    throw error;
  }
  return <QuestPlayer key={quest.slug} quest={quest} />;
}
