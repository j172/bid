"use client";

import type { ReactNode } from "react";

// 後台 modal 只有三種尺寸，Tailwind 需要完整 class 字串所以列成常數。
const PANEL_CLASS = {
  sm: "w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg",
  lg: "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg",
  xl: "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg",
} as const;

/**
 * 後台 modal 的共用外殼：遮罩 + 面板 + 標題。呼叫端自行控制開關
 * （條件式 render），這裡只負責版面。
 *
 * onOverlayClick 有值時才會啟用「點遮罩關閉」，面板本身則會擋掉冒泡 ——
 * 只有刪除確認 modal 需要這個行為，表單 modal 維持不能誤點關閉。
 */
export default function AdminModal({
  title,
  size = "sm",
  onOverlayClick,
  children,
}: {
  title: string;
  size?: keyof typeof PANEL_CLASS;
  onOverlayClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onOverlayClick}>
      <div className={PANEL_CLASS[size]} onClick={onOverlayClick ? (event) => event.stopPropagation() : undefined}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
