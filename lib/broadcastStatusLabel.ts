// Human labels for lib/newsletter.ts's BroadcastStatus — split into its own
// tiny module (issue #80) rather than living in lib/newsletter.ts itself
// because NewsFormModal.tsx ("use client") needs it too, and lib/newsletter.ts
// pulls in lib/email.ts's node:https import, which can't be bundled into
// client code. No I/O, nothing else — safe for both server and client.
export const BROADCAST_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  scheduled: "排程中",
  queued: "寄送中",
  sent: "已寄出",
  canceled: "已取消",
};
