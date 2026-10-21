import type { Instrumentation } from "next";

/**
 * 伺服器錯誤一律記一行結構化日誌（Vercel 的 Runtime Logs 看得到）。
 * 只記路徑、方法、錯誤類型與 digest，不記請求內容（可能有孩子暱稱或金額）。
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as { name?: string; message?: string; digest?: string; cause?: { code?: string } };
  console.error(
    JSON.stringify({
      level: "error",
      app: "wealth-blocks",
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
      digest: e?.digest ?? null,
      name: e?.name ?? "Error",
      pgCode: e?.cause?.code ?? null,
      message: (e?.message ?? String(err)).split("\n")[0].slice(0, 200),
    }),
  );
};
