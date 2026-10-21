"use client";

import { useActionState } from "react";
import { type FormState, setupFamilyAction } from "@/app/actions";
import { ChildFields } from "@/components/child-fields";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setupFamilyAction, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const err = (key: string) => (errors[key] ? <span className="field-error">{errors[key]}</span> : null);

  return (
    <form action={action} className="grid gap-5">
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}

      <section className="card grid gap-4 p-5">
        <h2 className="sec-title">家長</h2>
        <label className="field">
          <span>家庭名稱</span>
          <input className="input" name="familyName" maxLength={20} required placeholder="例如：陳家" defaultValue={values.familyName} aria-invalid={Boolean(errors.familyName)} />
          {err("familyName")}
        </label>
        <label className="field">
          <span>
            你的稱呼<small>孩子會看到，例如「媽媽」</small>
          </span>
          <input className="input" name="parentName" maxLength={20} required defaultValue={values.parentName} aria-invalid={Boolean(errors.parentName)} />
          {err("parentName")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>家長 PIN</span>
            <input className="input input-pin" name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required aria-invalid={Boolean(errors.pin)} />
          </label>
          <label className="field">
            <span>再輸入一次</span>
            <input className="input input-pin" name="pinConfirm" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="new-password" required aria-invalid={Boolean(errors.pinConfirm)} />
          </label>
        </div>
        {err("pin")}
        {err("pinConfirm")}
        <p className="text-[13px] text-ink-2">4 位數字，不要用 1234、0000 這種好猜的組合。</p>
      </section>

      <section className="card grid gap-4 p-5">
        <h2 className="sec-title">第一位孩子</h2>
        <ChildFields prefix="child." errors={errors} values={values} />
      </section>

      <button className="btn btn-primary btn-block" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "建立中…" : "建立家庭與積木島"}
      </button>
    </form>
  );
}
