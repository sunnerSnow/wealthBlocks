"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BlockArt } from "@/components/art/block-art";
import { Bricks } from "@/components/game/bricks";
import { GoalArt } from "@/components/game/goal-mini";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useConfetti, useToast } from "@/components/ui/feedback";
import { ApiError, api, newRequestId } from "@/lib/client/api";
import type { GoalDto, GoalMoveDto, GoalsDto } from "@/lib/services/goals";

const WEEKLY = 20;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Move = { kind: "in" | "out"; goalId: string; amount: number };
type Create = { pick: string | "custom"; title: string; target: number };

export function GoalsView({ initial }: { initial: GoalsDto }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [move, setMove] = useState<Move | null>(null);
  const [create, setCreate] = useState<Create | null>(null);
  const [done, setDone] = useState<GoalDto | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const { say, node: toastNode } = useToast();
  const { burst, node: confettiNode } = useConfetti();

  const active = data.goals.filter((g) => g.status === "active");
  const completed = data.goals.filter((g) => g.status === "completed");
  const full = active.length >= data.maxActive;

  async function reload() {
    setData(await api<GoalsDto>("GET", "/api/goals"));
    router.refresh();
  }

  function fail(error: unknown) {
    say(error instanceof ApiError ? error.message : "系統發生錯誤，請稍後再試");
  }

  function openMove(kind: Move["kind"], goal: GoalDto) {
    requestId.current = newRequestId();
    const max = kind === "in" ? Math.min(data.balance, goal.target - goal.saved) : goal.saved;
    setMove({ kind, goalId: goal.id, amount: Math.min(20, max) });
  }

  async function submitMove() {
    if (!move || busy || !requestId.current) return;
    setBusy(true);
    try {
      const res = await api<GoalMoveDto>("POST", `/api/goals/${move.goalId}/${move.kind === "in" ? "contribute" : "withdraw"}`, {
        amount: move.amount,
        requestId: requestId.current,
      });
      setMove(null);
      if (res.completed) {
        setDone(res.goal);
        burst();
      } else {
        say(move.kind === "in" ? `已存入 ${move.amount} 積木幣，還差 ${res.goal.target - res.goal.saved}` : `取回 ${move.amount} 積木幣，已回到錢包`);
      }
      await reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    if (!create || busy) return;
    setBusy(true);
    try {
      const body = create.pick === "custom" ? { title: create.title.trim(), target: create.target } : { reward: create.pick };
      const goal = await api<GoalDto>("POST", "/api/goals", body);
      setCreate(null);
      say(`已建立目標「${goal.title}」`);
      await reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  const moving = move ? data.goals.find((g) => g.id === move.goalId) : null;
  const moveMax = moving && move ? (move.kind === "in" ? Math.min(data.balance, moving.target - moving.saved) : moving.saved) : 0;
  const amount = move ? clamp(move.amount, 0, moveMax) : 0;
  const createTarget = create ? (create.pick === "custom" ? create.target : (data.options.find((o) => o.slug === create.pick)?.target ?? 0)) : 0;
  const createValid = create ? (create.pick === "custom" ? create.title.trim().length > 0 && create.target >= 10 : createTarget > 0) : false;

  function GoalCard({ goal }: { goal: GoalDto }) {
    const pct = Math.round((goal.saved / goal.target) * 100);
    const left = goal.target - goal.saved;
    return (
      <article className="card gcard">
        <GoalArt goal={goal} className="gcard-art" />
        <div className="gcard-body">
          <div className="gcard-title">
            <h3>{goal.title}</h3>
            {goal.status === "completed" ? (
              <span className="qstate done">
                <Icon name="check" />
                已達成
              </span>
            ) : null}
          </div>
          <div className="gnums">
            <span className="big">{goal.saved}</span>
            <span>/ {goal.target} 積木幣</span>
            <span className="pct">{pct}%</span>
          </div>
          <Bricks percent={pct} label={`${goal.title} 儲蓄進度`} />
          {goal.status === "active" ? (
            <>
              <p className="gleft">
                還差 <b>{left}</b> 積木幣 · 如果每週存 {WEEKLY}，大約 {Math.ceil(left / WEEKLY)} 週後達成
              </p>
              <div className="gactions">
                <button type="button" className="btn btn-sm" disabled={goal.saved === 0} onClick={() => openMove("out", goal)}>
                  <Icon name="arrowOut" />
                  取回
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={data.balance === 0} onClick={() => openMove("in", goal)}>
                  <Icon name="arrowIn" />
                  存入
                </button>
              </div>
              {data.balance === 0 ? <p className="gleft">錢包沒有積木幣了，可以先去完成任務。</p> : null}
            </>
          ) : (
            <p className="gleft">{goal.reward ? `「${goal.reward.name}」已經解鎖，放進收藏了。` : "這個目標完成了，做得好！"}</p>
          )}
        </div>
      </article>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {data.canCreate ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={full}
            onClick={() => setCreate({ pick: data.options[0]?.slug ?? "custom", title: "", target: 100 })}
          >
            <Icon name="plus" />
            新增目標
          </button>
        ) : (
          <span className="ghint m-0">
            <Icon name="info" />
            儲蓄目標由家長幫你設定，想存什麼可以跟家長討論。
          </span>
        )}
        <span className="text-[14px] text-ink-2">錢包裡有 {data.balance} 積木幣</span>
      </div>
      {full && data.canCreate ? (
        <p className="ghint">
          <Icon name="info" />
          一次最多 {data.maxActive} 個進行中的目標，先完成或取回其中一個吧。
        </p>
      ) : null}

      <div className="ggrid">
        {active.length ? (
          active.map((g) => <GoalCard key={g.id} goal={g} />)
        ) : (
          <p className="card p-5 text-ink-2">
            {data.canCreate ? "還沒有儲蓄目標。按「新增目標」，挑一個想要的建築開始存積木幣吧！" : "還沒有儲蓄目標。可以跟家長說說你想存錢買什麼。"}
          </p>
        )}
      </div>
      {completed.length ? (
        <>
          <h2 className="sec-title mt-7">已達成</h2>
          <div className="ggrid">
            {completed.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </>
      ) : null}

      <Sheet
        open={move !== null && moving !== null}
        onClose={() => setMove(null)}
        title={moving && move ? `${move.kind === "in" ? "存入" : "取回"}「${moving.title}」` : ""}
        footer={
          move ? (
            <>
              <button type="button" className="btn" onClick={() => setMove(null)} disabled={busy}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void submitMove()} disabled={busy || amount <= 0} aria-busy={busy}>
                {busy ? "處理中…" : `${move.kind === "in" ? "存入" : "取回"} ${amount} 積木幣`}
              </button>
            </>
          ) : null
        }
      >
        {moving && move ? (
          <>
            <div className="amount">
              <button type="button" className="step" aria-label="減少 5" disabled={amount <= 0} onClick={() => setMove({ ...move, amount: clamp(amount - 5, 0, moveMax) })}>
                <Icon name="minus" />
              </button>
              <div>
                <span className="num" aria-live="polite">
                  {amount}
                </span>
                <span className="unit">積木幣</span>
              </div>
              <button type="button" className="step" aria-label="增加 5" disabled={amount >= moveMax} onClick={() => setMove({ ...move, amount: clamp(amount + 5, 0, moveMax) })}>
                <Icon name="plus" />
              </button>
            </div>
            <div className="quick">
              {[10, 20, 50]
                .filter((v) => v < moveMax)
                .map((v) => (
                  <button key={v} type="button" className="chip" aria-pressed={amount === v} onClick={() => setMove({ ...move, amount: v })}>
                    {v}
                  </button>
                ))}
              {moveMax > 0 ? (
                <button type="button" className="chip" aria-pressed={amount === moveMax} onClick={() => setMove({ ...move, amount: moveMax })}>
                  {move.kind === "in" && moveMax === moving.target - moving.saved ? `剛好補滿 ${moveMax}` : `全部 ${moveMax}`}
                </button>
              ) : null}
            </div>
            <div className="pricebox">
              <div className="row">
                <span>錢包</span>
                <span className="num">
                  {data.balance}
                  <span className="arrow">→</span>
                  {move.kind === "in" ? data.balance - amount : data.balance + amount}
                </span>
              </div>
              <div className="row">
                <span>{moving.title}</span>
                <span className="num">
                  {moving.saved}
                  <span className="arrow">→</span>
                  {move.kind === "in" ? moving.saved + amount : moving.saved - amount} / {moving.target}
                </span>
              </div>
              <Bricks percent={((move.kind === "in" ? moving.saved + amount : moving.saved - amount) / moving.target) * 100} label="存入後的進度" />
            </div>
            {move.kind === "in" && moving.saved + amount >= moving.target ? (
              <div className="okbox">
                <Icon name="sparkle" />
                <span>存入後就能達成目標，解鎖「{moving.reward?.name ?? moving.title}」！</span>
              </div>
            ) : null}
            {move.kind === "out" ? (
              <div className="think">
                <Icon name="bulb" />
                <span>取回不會有任何處罰。計畫改變時，調整目標也是很好的選擇。</span>
              </div>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={create !== null}
        onClose={() => setCreate(null)}
        title="新增儲蓄目標"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreate(null)} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void submitCreate()} disabled={busy || !createValid} aria-busy={busy}>
              建立目標
            </button>
          </>
        }
      >
        {create ? (
          <>
            <p className="mb-2 font-bold">想為什麼存錢？</p>
            <div className="pick-grid" role="radiogroup" aria-label="目標獎勵">
              {data.options.map((o) => (
                <button key={o.slug} type="button" className="pick" role="radio" aria-checked={create.pick === o.slug} onClick={() => setCreate({ ...create, pick: o.slug })}>
                  <BlockArt asset={o.assetKey} />
                  {o.name}
                  <small>{o.target}</small>
                </button>
              ))}
              <button type="button" className="pick" role="radio" aria-checked={create.pick === "custom"} onClick={() => setCreate({ ...create, pick: "custom" })}>
                <Icon name="piggy" className="ic big" />
                自己的目標
                <small>自訂金額</small>
              </button>
            </div>
            {create.pick === "custom" ? (
              <>
                <label className="field mt-4">
                  <span>目標名稱</span>
                  <input
                    className="input"
                    maxLength={12}
                    placeholder="例如：生日禮物"
                    value={create.title}
                    onChange={(e) => setCreate({ ...create, title: e.target.value })}
                  />
                </label>
                <p className="mt-4 text-[14px] font-bold">目標金額</p>
                <div className="amount">
                  <button type="button" className="step" aria-label="減少 10" disabled={create.target <= 10} onClick={() => setCreate({ ...create, target: clamp(create.target - 10, 10, 500) })}>
                    <Icon name="minus" />
                  </button>
                  <div>
                    <span className="num">{create.target}</span>
                    <span className="unit">積木幣</span>
                  </div>
                  <button type="button" className="step" aria-label="增加 10" disabled={create.target >= 500} onClick={() => setCreate({ ...create, target: clamp(create.target + 10, 10, 500) })}>
                    <Icon name="plus" />
                  </button>
                </div>
              </>
            ) : null}
            {createTarget ? (
              <div className="think">
                <Icon name="bulb" />
                <span>
                  目標 {createTarget} 積木幣。如果每週存 {WEEKLY}，大約 {Math.ceil(createTarget / WEEKLY)} 週可以達成。
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={done !== null}
        onClose={() => setDone(null)}
        title="目標達成！"
        footer={
          done?.reward ? (
            <>
              <button type="button" className="btn" onClick={() => setDone(null)}>
                稍後再說
              </button>
              <Link className="btn btn-success" href="/play">
                <Icon name="hammer" />
                放到島上
              </Link>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setDone(null)}>
              太好了
            </button>
          )
        }
      >
        {done ? (
          <>
            <div className="art-stage">{done.reward ? <BlockArt asset={done.reward.assetKey} /> : <Icon name="piggy" className="ic big" />}</div>
            <p className="text-center">
              你存滿了 <b className="num">{done.target}</b> 積木幣{done.reward ? `，「${done.reward.name}」已經放進收藏` : ""}。
              <br />
              一點一點存，真的會到達目標。
            </p>
          </>
        ) : null}
      </Sheet>
      {toastNode}
      {confettiNode}
    </>
  );
}
