"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

export default function ResetPasswordButton({ userId, email }: { userId: number; email: string }) {
  return (
    <ConfirmActionButton
      confirmMessage={`確定要寄送重設密碼信到 ${email} 嗎？使用者需自行透過信件連結設定新密碼。`}
      endpoint={`/api/admin/users/${userId}/reset-password`}
      method="POST"
      errorFallback="操作失敗"
      label="重置密碼"
      buttonClassName="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      // 寄信不會改變列表上的任何欄位，所以只顯示成功訊息、不 refresh。
      refreshOnSuccess={false}
      successMessage={(data) => `已寄出重設密碼信至 ${typeof data.email === "string" ? data.email : email}`}
    />
  );
}
