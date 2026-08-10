"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

// Moved here from app/z04urru6/newsletter/ (issue #80) — the standalone
// newsletter status list is gone, so this is now the news admin list's
// inline "取消" action for a row's 電子報狀態 column (draft/scheduled only,
// see page.tsx). Logic unchanged: still just DELETEs the Resend broadcast
// via the same /api/admin/newsletter/[id] route.
export default function CancelBroadcastButton({ broadcastId }: { broadcastId: string }) {
  return (
    <ConfirmActionButton
      confirmMessage="確定要取消這封電子報嗎？"
      endpoint={`/api/admin/newsletter/${broadcastId}`}
      method="DELETE"
      errorFallback="取消失敗"
      label="取消"
      buttonClassName="rounded-md border border-ended px-2 py-1 text-xs font-medium text-ended hover:bg-ended-bg disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
