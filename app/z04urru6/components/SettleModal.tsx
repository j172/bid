"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminModal from "./AdminModal";
import ModalFormActions from "./ModalFormActions";

const inputClass = "rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

/**
 * 「標記已完成交易」表單，已結標商品（/api/admin/listings/[id]/settle）與
 * 訂單（/api/admin/orders/[id]/settle）共用一份 —— 兩邊原本是逐行相同的
 * 複製體（issue #139 H2），差別只有 API 位置與金額預設值。
 */
export default function SettleModal({
  endpoint,
  defaultAmount,
  previousAccount,
  previousAmount,
}: {
  endpoint: string;
  /** 尚未填過金額時帶入的預設值：商品的成交價或訂單的總金額。 */
  defaultAmount: number;
  previousAccount: string | null;
  previousAmount: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(previousAccount ?? "");
  const [amount, setAmount] = useState(String(previousAmount ?? defaultAmount));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setAccount(previousAccount ?? "");
    setAmount(String(previousAmount ?? defaultAmount));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, amount: Number(amount) }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "標記失敗");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-leading px-3 py-1.5 text-sm font-medium text-leading hover:bg-leading-bg"
      >
        標記已完成交易
      </button>

      {open && (
        <AdminModal title="標記已完成交易">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              匯款帳號
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                required
                minLength={4}
                maxLength={30}
                pattern="[A-Za-z0-9-]+"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              金額
              <input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                min={1}
                step={1}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-ended">{error}</p>}
            <ModalFormActions
              onCancel={() => {
                setOpen(false);
                resetForm();
              }}
              submitting={submitting}
              submitLabel="確認標記"
              pendingLabel="處理中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
