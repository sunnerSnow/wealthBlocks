/** 積木進度條：10 塊積木，一塊 = 10%；color="sun" 用黃色（任務完成度） */
export function Bricks({ percent, label, color }: { percent: number; label: string; color?: "sun" }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className={`bricks ${color ?? ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => {
        const f = Math.max(0, Math.min(10, pct - i * 10));
        return f >= 10 ? <i key={i} className="on" /> : f > 0 ? <i key={i} className="part" style={{ ["--p" as string]: `${f * 10}%` }} /> : <i key={i} />;
      })}
    </div>
  );
}
