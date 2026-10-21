"use client";

import { ErrorScreen } from "@/components/ui/error-screen";

/** 孩子模式的頁面出錯時：外框（積木幣、導覽）還在，只有內容區換成這個畫面 */
export default function PlayError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} home="/play" />;
}
