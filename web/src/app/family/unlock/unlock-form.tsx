"use client";

import { useActionState } from "react";
import { type FormState, unlockParentAction } from "@/app/actions";

export function UnlockForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(unlockParentAction, {});
  return (
    <form action={action} className="card grid gap-4 p-5">
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="field">
        <span>家長 PIN</span>
        <input
          className="input input-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
        />
      </label>
      <button className="btn btn-primary btn-block" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "確認中…" : "進入家長區"}
      </button>
    </form>
  );
}
