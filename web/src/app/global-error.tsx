"use client";

/** 連根版面都出錯時的最後防線：不能依賴全站樣式，所以用行內樣式 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="zh-Hant-TW">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F2E8", color: "#20334F", fontFamily: "system-ui, sans-serif" }}>
        <title>財富積木</title>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>哎呀，積木倒了</h1>
          <p style={{ color: "#56647A" }}>畫面出了一點問題，請再試一次。</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 12, minHeight: 48, padding: "0 20px", border: 0, borderRadius: 14, background: "#FFD34E", color: "#20334F", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            再試一次
          </button>
        </main>
      </body>
    </html>
  );
}
