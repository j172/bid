"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

export default function DisableTwoFactorButton({ userId, email }: { userId: number; email: string }) {
  return (
    <ConfirmActionButton
      confirmMessage={`確定要關閉 ${email} 的兩階段驗證嗎？關閉後該使用者登入時將不再需要輸入驗證碼。`}
      endpoint={`/api/admin/users/${userId}/disable-two-factor`}
      method="POST"
      errorFallback="操作失敗"
      label="關閉兩階段驗證"
      buttonClassName="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
