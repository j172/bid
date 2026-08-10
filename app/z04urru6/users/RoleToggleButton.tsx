"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

export default function RoleToggleButton({
  userId,
  currentRole,
  isSelf,
}: {
  userId: number;
  currentRole: "admin" | "user";
  isSelf: boolean;
}) {
  // Demoting yourself is always rejected server-side — hide the action
  // entirely rather than let an admin click into a guaranteed error.
  if (isSelf && currentRole === "admin") {
    return <span className="text-xs text-ink-light">（本人）</span>;
  }

  const nextRole = currentRole === "admin" ? "user" : "admin";
  const label = currentRole === "admin" ? "降級為一般使用者" : "升級為管理員";
  const confirmMessage =
    currentRole === "admin" ? "確定要將這個管理員降級為一般使用者嗎？" : "確定要將這個使用者升級為管理員嗎？";

  return (
    <ConfirmActionButton
      confirmMessage={confirmMessage}
      endpoint={`/api/admin/users/${userId}/role`}
      method="POST"
      body={{ role: nextRole }}
      errorFallback="操作失敗"
      label={label}
      buttonClassName="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
