"use client";

import { useActionState, useState } from "react";
import { type FormState, updateChildSettingsAction } from "@/app/actions";
import { Icon } from "@/components/icons";
import { WEEKDAY_LABEL } from "@/lib/game/allowance";
import type { ChildSettingsDto } from "@/lib/services/settings";

const clamp = (v: number) => Math.max(5, Math.min(200, v));

/** 虛擬零用錢與孩子權限（規格 6.2）；每次儲存都會記進變更紀錄 */
export function SettingsForm({ childId, childName, settings }: { childId: string; childName: string; settings: ChildSettingsDto }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateChildSettingsAction, {});
  const [enabled, setEnabled] = useState(settings.allowanceEnabled);
  const [amount, setAmount] = useState(settings.allowanceAmount);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="allowanceAmount" value={amount} />
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.done && !pending ? (
        <p className="success" role="status">
          設定已儲存。
        </p>
      ) : null}

      <label className="switch-row">
        <span>
          <b>定期發虛擬零用錢</b>
          <small>到了發放日，{childName}打開遊戲時會自動入帳（記在帳本裡）</small>
        </span>
        {/* 不用受控的 checked：送出後 React 會重設表單，預設值要跟著伺服器存下來的設定 */}
        <input type="checkbox" name="allowanceEnabled" className="switch" defaultChecked={settings.allowanceEnabled} onChange={(e) => setEnabled(e.target.checked)} />
      </label>

      <fieldset className={`fieldset ${enabled ? "" : "is-off"}`}>
        <legend>每次發多少</legend>
        <div className="amount small-amount">
          <button type="button" className="step" aria-label="減少 5" disabled={!enabled || amount <= 5} onClick={() => setAmount((a) => clamp(a - 5))}>
            <Icon name="minus" />
          </button>
          <div>
            <span className="num" aria-live="polite">
              {amount}
            </span>
            <span className="unit">積木幣</span>
          </div>
          <button type="button" className="step" aria-label="增加 5" disabled={!enabled || amount >= 200} onClick={() => setAmount((a) => clamp(a + 5))}>
            <Icon name="plus" />
          </button>
        </div>
      </fieldset>

      <fieldset className={`fieldset ${enabled ? "" : "is-off"}`}>
        <legend>多久發一次</legend>
        <div className="tiles">
          {([7, 14] as const).map((d) => (
            <label key={d} className="tile">
              <input type="radio" name="allowanceInterval" value={d} defaultChecked={settings.allowanceInterval === d} />
              {d === 7 ? "每週" : "每兩週"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`fieldset ${enabled ? "" : "is-off"}`}>
        <legend>發放日（台北時間早上 8 點）</legend>
        <div className="tiles">
          {WEEKDAY_LABEL.map((label, i) => (
            <label key={label} className="tile">
              <input type="radio" name="allowanceWeekday" value={i} defaultChecked={settings.allowanceWeekday === i} />
              {label.replace("星期", "週")}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="switch-row">
        <span>
          <b>讓{childName}自己設定儲蓄目標</b>
          <small>關掉時，由家長在這一頁幫{childName}建立目標</small>
        </span>
        <input type="checkbox" name="allowChildGoals" className="switch" defaultChecked={settings.allowChildGoals} />
      </label>

      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "儲存中…" : "儲存設定"}
      </button>
    </form>
  );
}
