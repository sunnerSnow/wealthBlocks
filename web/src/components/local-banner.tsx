import { isLocalMode } from "@/lib/config";

export function LocalBanner() {
  if (!isLocalMode()) return null;
  return <div className="local-banner">本機示範模式：資料只存在這台電腦，不是正式資料庫</div>;
}
