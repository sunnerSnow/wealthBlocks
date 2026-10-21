"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";

/** 戴上／摘下造型 */
export function WearButton({ slug, equipped }: { slug: string; equipped: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/shop/equip", { slug: equipped ? null : slug });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "系統發生錯誤");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn ${equipped ? "" : "btn-primary"}`} disabled={busy} aria-busy={busy} onClick={() => void toggle()}>
        {equipped ? "摘下" : "戴上"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </>
  );
}
