/** 前端呼叫自己 API 的小工具：回應格式 { data, meta, errors }，失敗時丟出帶中文訊息的 ApiError */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  data: T | null;
  errors: { code: string; message: string }[];
}

export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("連線不穩，請再試一次", "network", 0);
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.data === null) {
    const first = json?.errors?.[0];
    throw new ApiError(first?.message ?? "系統發生錯誤，請稍後再試", first?.code ?? "unknown", res.status);
  }
  return json.data;
}

/**
 * 每一次「確認」產生一個請求編號，重送時帶同一個，伺服器就不會重複扣款或發獎勵。
 * 用 getRandomValues 自己組 UUID：在區網的 http 網址（手機測試）也能用，randomUUID 只在 https／localhost 有。
 */
export function newRequestId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
