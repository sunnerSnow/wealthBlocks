"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { BlockArt } from "@/components/art/block-art";
import { Coin } from "@/components/brand";
import { Bricks } from "@/components/game/bricks";
import { JAR_COLOR, JarArt } from "@/components/game/jar-art";
import { CategoryChip } from "@/components/game/quest-card";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useConfetti, useToast } from "@/components/ui/feedback";
import { ApiError, api, newRequestId } from "@/lib/client/api";
import { type Allocation, type QuestAnswer, questResult } from "@/lib/game/quests";
import type { LevelUpDto, QuestCompletionDto, QuestDetailDto } from "@/lib/services/quests";

/** 故事文字裡的 **數字** 顯示成重點 */
function Story({ text }: { text: string }): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

export function QuestPlayer({ quest }: { quest: QuestDetailDto }) {
  const router = useRouter();
  const { content } = quest;
  const [step, setStep] = useState<"play" | "result">("play");
  const [choice, setChoice] = useState<string | null>(null);
  const [alloc, setAlloc] = useState<Allocation>({ spend: 0, save: 0, share: 0 });
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<QuestCompletionDto | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUpDto | null>(null);
  const requestId = useRef<string | null>(null);
  const { say, node: toastNode } = useToast();
  const { burst, node: confettiNode } = useConfetti();

  const answer: QuestAnswer = content.kind === "alloc" ? { alloc } : { choice: choice ?? undefined };
  const result = questResult(content, answer);
  const done = quest.status === "done";
  const left = content.kind === "alloc" ? content.alloc.total - alloc.spend - alloc.save - alloc.share : 0;

  function changeAnswer(update: () => void) {
    update();
    // 改了答案就是新的一次送出
    requestId.current = null;
    setClaimed(null);
  }

  async function claim() {
    if (!result || busy) return;
    requestId.current ??= newRequestId();
    setBusy(true);
    try {
      const res = await api<QuestCompletionDto>("POST", `/api/quests/${quest.slug}/complete`, { ...answer, requestId: requestId.current });
      setClaimed(res);
      say(res.rewarded ? `+${res.coins} 積木幣、+${res.xp} 經驗，已記入帳本` : "完成！這個任務的獎勵之前已經領過了");
      if (res.levelUp) {
        setLevelUp(res.levelUp);
        burst();
      }
      router.refresh();
    } catch (error) {
      say(error instanceof ApiError ? error.message : "系統發生錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  const art = content.art.map((a, i) =>
    a === "jar" ? (
      (["spend", "save", "share"] as const).map((k) => <JarArt key={`${i}-${k}`} fill={0.6} color={JAR_COLOR[k]} className="small" />)
    ) : (
      <BlockArt key={i} asset={a} className={a === "car" || a === "cloud" ? "small" : undefined} />
    ),
  );

  return (
    <section className="quest-wrap">
      <div className="quest-top">
        <Link className="icon-btn" href="/play/quests" aria-label="回到任務清單">
          <Icon name="back" />
        </Link>
        <CategoryChip category={quest.category} />
        <h1>{quest.title}</h1>
      </div>
      <ol className="steps" aria-label="任務步驟">
        <li className={step === "play" ? "on" : "ok"} aria-current={step === "play" ? "step" : undefined}>
          1 情境與選擇
        </li>
        <li className={step === "result" ? "on" : ""} aria-current={step === "result" ? "step" : undefined}>
          2 結果與反思
        </li>
      </ol>

      {step === "play" ? (
        <>
          <div className="story">
            <div className="story-art">{art}</div>
            <div className="story-text">
              {content.story.map((p, i) => (
                <p key={i}>
                  <Story text={p} />
                </p>
              ))}
            </div>
          </div>
          {content.resources ? (
            <div className="res-row">
              {content.resources.map((r) => (
                <div key={r.label} className="res">
                  <small>{r.label}</small>
                  <b>
                    <Coin />
                    {r.value}
                  </b>
                </div>
              ))}
            </div>
          ) : null}
          <p className="sim-note">
            <Icon name="info" />
            這是故事裡的情境，不會用到你真正的積木幣。
          </p>
          <h2 className="q-ask">{content.ask}</h2>

          {content.kind === "choice" ? (
            <div className="opts" role="radiogroup" aria-label={content.ask}>
              {content.options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className="opt"
                  role="radio"
                  aria-checked={choice === o.key}
                  onClick={() => changeAnswer(() => setChoice(o.key))}
                >
                  <span className="opt-key">{o.key}</span>
                  <span className="opt-text">
                    <b>{o.text}</b>
                    <small>{o.hint}</small>
                  </span>
                  <span className="opt-check">
                    <Icon name="check" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="jars">
                {content.alloc.jars.map((j) => {
                  const v = alloc[j.key];
                  const stepBy = content.alloc.step;
                  return (
                    <div key={j.key} className="jar">
                      <JarArt fill={v / content.alloc.total} color={JAR_COLOR[j.key]} />
                      <div className="jar-info">
                        <b>{j.label}</b>
                        <small>{j.desc}</small>
                      </div>
                      <div className="stepper">
                        <button
                          type="button"
                          className="step"
                          aria-label={`${j.label}罐減少 ${stepBy}`}
                          disabled={v <= 0}
                          onClick={() => changeAnswer(() => setAlloc((a) => ({ ...a, [j.key]: Math.max(0, a[j.key] - stepBy) })))}
                        >
                          <Icon name="minus" />
                        </button>
                        <span className="num" aria-live="polite" aria-label={`${j.label}罐 ${v} 積木幣`}>
                          {v}
                        </span>
                        <button
                          type="button"
                          className="step"
                          aria-label={`${j.label}罐增加 ${stepBy}`}
                          disabled={left < stepBy}
                          onClick={() => changeAnswer(() => setAlloc((a) => ({ ...a, [j.key]: a[j.key] + stepBy })))}
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={`alloc-left ${left ? "" : "done"}`} aria-live="polite">
                {left ? (
                  <>
                    還有 <b>{left}</b> 積木幣還沒分配
                  </>
                ) : (
                  "全部分配好了！"
                )}
              </p>
            </>
          )}

          <div className="quest-foot">
            <p className="note">
              {done ? (
                <>
                  <Icon name="check" />
                  這個任務的獎勵已經領過了，可以自由試試不同的選擇。
                </>
              ) : (
                <>
                  完成可得 <Icon name="star" />+{quest.rewardXp} 經驗、
                  <Coin />+{quest.rewardCoins} 積木幣（不論選哪一個）
                </>
              )}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!result}
              onClick={() => {
                setStep("result");
                window.scrollTo({ top: 0 });
              }}
            >
              {content.kind === "alloc" ? "完成分配" : "就選這個"}
            </button>
          </div>
        </>
      ) : result ? (
        <>
          <div className="recap">
            <small>你的選擇</small>
            <b>{result.label}</b>
          </div>
          <div className="stats">
            {result.stats.map((s) => (
              <div key={s.label} className="stat">
                <small>{s.label}</small>
                {typeof s.value === "string" ? <b className="text">{s.value}</b> : <b>{s.value}</b>}
                {s.unit ? <span>{s.unit}</span> : null}
              </div>
            ))}
          </div>
          {result.goal ? (
            <div className="viz">
              <div className="viz-head">
                <span>夢想小屋進度</span>
                <span className="num">
                  {result.goal.saved} / {result.goal.target}
                </span>
              </div>
              <Bricks percent={(result.goal.saved / result.goal.target) * 100} label="故事中夢想小屋的進度" />
            </div>
          ) : null}
          {result.alloc && content.kind === "alloc" ? (
            <div className="viz">
              <div className="viz-head">
                <span>{content.alloc.total} 積木幣怎麼分</span>
              </div>
              <div className="stack">
                {content.alloc.jars.map((j) => (
                  <i key={j.key} style={{ width: `${(result.alloc![j.key] / content.alloc.total) * 100}%`, background: JAR_COLOR[j.key] }} />
                ))}
              </div>
              <div className="legend">
                {content.alloc.jars.map((j) => (
                  <span key={j.key} style={{ ["--c" as string]: JAR_COLOR[j.key] }}>
                    {j.label} {Math.round((result.alloc![j.key] / content.alloc.total) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="procon">
            <div className="pc pro">
              <h3>
                <Icon name="thumb" />
                好處
              </h3>
              <ul>
                {result.pros.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="pc con">
              <h3>
                <Icon name="bulb" />
                要想一想
              </h3>
              <ul>
                {result.cons.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="no-answer">
            <b>沒有標準答案</b>每個選擇都有好處，也有要付出的代價。重要的是想清楚自己為什麼這樣選。
          </p>
          <div className="reflect">
            <small>思考題</small>
            <p>{content.reflect}</p>
            <span>可以和家人聊聊你的想法</span>
          </div>

          <div className="quest-foot">
            {claimed ? (
              <>
                <p className="note">
                  <Icon name="check" />
                  {claimed.rewarded ? `已領取 +${claimed.coins} 積木幣、+${claimed.xp} 經驗` : "完成！這次的選擇已經記進學習紀錄"}
                </p>
                <div className="row">
                  <Link className="btn" href="/play/quests">
                    回到任務
                  </Link>
                  <Link className="btn btn-primary" href="/play">
                    回到積木島
                  </Link>
                </div>
              </>
            ) : (
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setStep("play");
                    window.scrollTo({ top: 0 });
                  }}
                >
                  換個選擇看看
                </button>
                <button type="button" className={`btn ${done ? "btn-success" : "btn-primary"}`} disabled={busy} aria-busy={busy} onClick={() => void claim()}>
                  {busy ? "處理中…" : done ? "完成" : `領取獎勵 +${quest.rewardXp} 經驗 +${quest.rewardCoins} 幣`}
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      <Sheet
        open={levelUp !== null}
        onClose={() => setLevelUp(null)}
        title="升級了！"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setLevelUp(null)}>
            太好了
          </button>
        }
      >
        {levelUp ? (
          <>
            <div className="lvl-hero">
              <span className="big">Lv.{levelUp.level}</span>
              <h3>你現在是「{levelUp.title}」</h3>
            </div>
            {levelUp.unlocks.items.length || levelUp.unlocks.quests.length ? (
              <>
                <p className="mt-3 font-bold">新解鎖</p>
                <ul className="unlock-list">
                  {levelUp.unlocks.items.map((i) => (
                    <li key={i.slug}>
                      <BlockArt asset={i.assetKey} />
                      商店：{i.name}
                    </li>
                  ))}
                  {levelUp.unlocks.quests.map((q) => (
                    <li key={q.slug}>
                      <CategoryChip category={q.category} />
                      任務：{q.title}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>
      {toastNode}
      {confettiNode}
    </section>
  );
}
