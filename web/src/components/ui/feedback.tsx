"use client";

import { type CSSProperties, useCallback, useEffect, useState } from "react";

/** 畫面下方的提示訊息（3 秒後自動消失） */
export function useToast() {
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  const say = useCallback((msg: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, msg })), []);
  const node = (
    <div className="toast-root" role="status" aria-live="polite">
      {toast ? (
        <div key={toast.id} className="toast">
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
  return { say, node };
}

const COLORS = ["#FFD34E", "#56B7A5", "#C95D43", "#20334F", "#FFFFFF"];

/** 積木彩帶：升級、目標達成時用；系統設定「減少動態效果」時不顯示（CSS 處理） */
export function useConfetti() {
  const [pieces, setPieces] = useState<CSSProperties[]>([]);
  useEffect(() => {
    if (!pieces.length) return;
    const timer = setTimeout(() => setPieces([]), 3200);
    return () => clearTimeout(timer);
  }, [pieces]);
  const burst = useCallback(() => {
    setPieces(
      Array.from({ length: 36 }, (_, i) => ({
        "--x": `${Math.random() * 100}%`,
        "--c": COLORS[i % COLORS.length],
        "--d": `${1.4 + Math.random() * 1.2}s`,
        "--dl": `${Math.random() * 0.35}s`,
        "--dx": `${(Math.random() - 0.5) * 160}px`,
        "--r": `${(Math.random() - 0.5) * 900}deg`,
      }) as CSSProperties),
    );
  }, []);
  const node = (
    <div className="fx" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={i} className="cf" style={style} />
      ))}
    </div>
  );
  return { burst, node };
}
