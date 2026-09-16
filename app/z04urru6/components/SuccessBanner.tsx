"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type SuccessBannerKind = "created" | "updated";

const MESSAGE: Record<SuccessBannerKind, string> = {
  created: "已成功建立",
  updated: "已成功更新",
};

const VISIBLE_MS = 3000;
const FADE_MS = 300;

/**
 * 後台列表頁頂端（篩選列／表格上方）的成功訊息 banner（issue #291）：綠底、
 * 固定文案（只依 kind 分「已成功建立」／「已成功更新」兩種，不帶實體名稱），
 * 顯示滿 3 秒後自動淡出、不提供手動關閉按鈕。
 *
 * fading 的計時只在這裡寫一次，被兩種觸發機制共用：
 * - SuccessBannerProvider／useSuccessBanner：modal 送出成功後就地留在原頁
 *   （EditListingModal、RelistModal、各 FormModal）。
 * - listings/ListingsCreatedBanner：NewListingForm 建立成功後整頁導頁回列表，
 *   靠網址上的 ?created=1 觸發，不經過 modal／context。
 */
export function SuccessBanner({ kind, onDone }: { kind: SuccessBannerKind; onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    setFading(false);
    const fadeTimer = setTimeout(() => setFading(true), VISIBLE_MS - FADE_MS);
    const hideTimer = setTimeout(onDone, VISIBLE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
    // kind 變動才需要重新計時；onDone 是呼叫端每次 render 都會重新產生的
    // closure，放進 deps 只會造成計時器被無謂地重建。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div
      role="status"
      className={`mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {MESSAGE[kind]}
    </div>
  );
}

const SuccessBannerContext = createContext<((kind: SuccessBannerKind) => void) | null>(null);

/**
 * 包住整個列表頁內容，讓深層的 modal（表格列裡的 EditListingModal、
 * RelistModal、各 FormModal 的「編輯」／「新增」按鈕）能在送出成功後觸發
 * 頁面頂端的 banner。
 *
 * 這裡改用 context、不用 callback prop，是因為這些頁面都是 async Server
 * Component（直接在伺服器端 fetch 資料），而 Server Component 沒辦法把
 * function 當 prop 傳給 Client Component（RSC 無法序列化函式）。Modal 本身
 * 已經是 "use client"，只要外層包了這個 Provider，modal 就能直接呼叫
 * useSuccessBanner() 觸發同一棵樹裡的 banner，完全不需要頁面本身改寫成
 * client component 或手動往下傳 prop。
 */
export function SuccessBannerProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SuccessBannerKind | null>(null);
  const showBanner = useCallback((next: SuccessBannerKind) => setKind(next), []);

  return (
    <SuccessBannerContext.Provider value={showBanner}>
      {kind && <SuccessBanner kind={kind} onDone={() => setKind(null)} />}
      {children}
    </SuccessBannerContext.Provider>
  );
}

/** 給 SuccessBannerProvider 底下的 modal 呼叫，觸發「已成功建立／更新」banner。 */
export function useSuccessBanner(): (kind: SuccessBannerKind) => void {
  const showBanner = useContext(SuccessBannerContext);
  if (!showBanner) {
    throw new Error("useSuccessBanner must be used within a SuccessBannerProvider");
  }
  return showBanner;
}
