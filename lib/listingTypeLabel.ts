import type { ListingType } from "@/lib/listings";

// 商品類型的中文標示。原本後台四個地方各自寫死，其中儀表板與 Command
// Palette 說「拍賣」、開放中商品列表說「競標商品」，同一種商品在不同頁面
// 名稱不一致（issue #139 M6）—— 統一採用建立商品表單與篩選下拉一直在用的
// 「競標商品」。
//
// 拆成獨立小模組（與 lib/broadcastStatusLabel.ts 同樣理由）而不是放在
// lib/listings.ts：AdminCommandPalette.tsx 是 "use client"，而 lib/listings.ts
// 會連帶拉進 lib/db.ts 的 mysql2，不能打包進 client code。
export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  auction: "競標商品",
  fixed_price: "一般商品",
};
