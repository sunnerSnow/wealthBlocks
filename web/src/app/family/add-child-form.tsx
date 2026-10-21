"use client";

import { useActionState, useState } from "react";
import { type FormState, addChildAction } from "@/app/actions";
import { ChildFields } from "@/components/child-fields";
import { Icon } from "@/components/icons";

export function AddChildForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const next = await addChildAction(prev, fd);
    if (next.done) setOpen(false);
    return next;
  }, {});

  if (!open) {
    return (
      <div className="grid gap-3">
        {state.done ? (
          <p className="success" role="status">
            已經建立新的積木島了！
          </p>
        ) : null}
        <button className="btn" type="button" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          新增孩子
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="card grid gap-4 p-5">
      <h2 className="sec-title">新增孩子</h2>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <ChildFields errors={state.fieldErrors} values={state.values} />
      <div className="flex gap-3">
        <button className="btn flex-1" type="button" onClick={() => setOpen(false)} disabled={pending}>
          取消
        </button>
        <button className="btn btn-primary flex-1" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "建立中…" : "建立積木島"}
        </button>
      </div>
    </form>
  );
}
