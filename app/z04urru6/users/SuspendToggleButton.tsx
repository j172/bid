"use client";

import ConfirmActionButton from "../components/ConfirmActionButton";

export default function SuspendToggleButton({
  userId,
  isSuspended,
  isSelf,
}: {
  userId: number;
  isSuspended: boolean;
  isSelf: boolean;
}) {
  // Suspending yourself is always rejected server-side — hide the action
  // entirely rather than let an admin click into a guaranteed error.
  if (isSelf && !isSuspended) {
    return <span className="text-xs text-ink-light">（本人）</span>;
  }

  const label = isSuspended ? "解除停權" : "停權";
  const confirmMessage = isSuspended
    ? "確定要解除這個帳號的停權嗎？"
    : "確定要停權這個帳號嗎？此帳號將立即無法登入。";

  return (
    <ConfirmActionButton
      confirmMessage={confirmMessage}
      endpoint={`/api/admin/users/${userId}/${isSuspended ? "unsuspend" : "suspend"}`}
      method="POST"
      errorFallback="操作失敗"
      label={label}
      buttonClassName={`rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        isSuspended ? "border-leading text-leading hover:bg-leading-bg" : "border-ended text-ended hover:bg-ended-bg"
      }`}
    />
  );
}
