"use client";

import { useActionState, useState } from "react";
import { type FormState, parentCreateGoalAction } from "@/app/actions";
import { BlockArt } from "@/components/art/block-art";
import { Icon } from "@/components/icons";
import type { GoalOptionDto } from "@/lib/services/goals";

/** 家長幫孩子建立儲蓄目標（孩子不能自己建立時用） */
export function ParentGoalForm({ childId, options }: { childId: string; options: GoalOptionDto[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(parentCreateGoalAction, {});
  const [pick, setPick] = useState(options[0]?.slug ?? "custom");

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="reward" value={pick} />
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.done && !pending ? (
        <p className="success" role="status">
          已經幫孩子建立目標了。
        </p>
      ) : null}
      <div className="pick-grid" role="radiogroup" aria-label="目標獎勵">
        {options.map((o) => (
          <button key={o.slug} type="button" className="pick" role="radio" aria-checked={pick === o.slug} onClick={() => setPick(o.slug)}>
            <BlockArt asset={o.assetKey} />
            {o.name}
            <small>{o.target}</small>
          </button>
        ))}
        <button type="button" className="pick" role="radio" aria-checked={pick === "custom"} onClick={() => setPick("custom")}>
          <Icon name="piggy" className="ic big" />
          自訂目標
          <small>自己填金額</small>
        </button>
      </div>
      {pick === "custom" ? (
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="field">
            <span>目標名稱</span>
            <input className="input" name="title" maxLength={12} required placeholder="例如：生日禮物" defaultValue={state.values?.title} />
          </label>
          <label className="field">
            <span>金額</span>
            <input className="input" name="target" type="number" min={10} max={500} step={10} required defaultValue={state.values?.target ?? 100} />
          </label>
        </div>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "建立中…" : "幫孩子建立目標"}
      </button>
    </form>
  );
}
