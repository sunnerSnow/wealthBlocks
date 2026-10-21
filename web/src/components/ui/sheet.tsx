"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { Icon } from "@/components/icons";

/** 原生 dialog 做的底部抽屜（手機）／置中視窗（平板以上）：焦點鎖定與 Esc 關閉交給瀏覽器 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet-dialog" onClose={onClose} aria-labelledby={titleId}>
      {open ? (
        <>
          <div className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="關閉">
              <Icon name="x" />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer ? <div className="sheet-foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
