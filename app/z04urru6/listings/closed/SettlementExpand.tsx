"use client";

import { useState } from "react";

export default function SettlementExpand({ account, amount }: { account: string; amount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-medium text-leading hover:underline"
      >
        已完成交易 {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-border bg-surface-muted p-2 text-xs">
          <div>匯款帳號：{account}</div>
          <div>金額：{amount}</div>
        </div>
      )}
    </div>
  );
}
