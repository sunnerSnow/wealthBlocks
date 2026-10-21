/** 本機示範模式的兩位固定家長（各自建立家庭，可用來確認兩個家庭的資料互相看不到） */
export const LOCAL_USERS = [
  { key: "a", id: "00000000-0000-4000-8000-0000000000a1", email: "parent-a@wealthblocks.local", label: "示範家長 A" },
  { key: "b", id: "00000000-0000-4000-8000-0000000000b1", email: "parent-b@wealthblocks.local", label: "示範家長 B" },
] as const;

export const LOCAL_SESSION_COOKIE = "wb_local_user";
