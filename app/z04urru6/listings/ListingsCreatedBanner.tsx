"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SuccessBanner } from "../components/SuccessBanner";

/**
 * NewListingForm 建立成功後會整頁導頁到 /z04urru6/listings?created=1
 * （issue #291）—— 這是整頁 navigation，不是就地留著的 modal，所以用不上
 * SuccessBannerProvider 的 context 機制，改成讀網址上的 marker 觸發同一顆
 * SuccessBanner。顯示後立刻用 router.replace 把 ?created=1 從網址拿掉，
 * 避免使用者手動重新整理又跳出一次。
 */
export default function ListingsCreatedBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;
    setShow(true);

    const next = new URLSearchParams(searchParams.toString());
    next.delete("created");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  if (!show) return null;
  return <SuccessBanner kind="created" onDone={() => setShow(false)} />;
}
