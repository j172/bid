# SPEC: 修正合作鴿舍圖片上傳路徑與後備圖 Optimizer 502 破圖問題 (Loft Image Path & Fallback Optimizer Fix)

## 1. 背景與問題

在訪問合作鴿舍專頁 `/listings?loft=2`（石君鴿舍）或拍品詳情頁帶有合作鴿舍頭像時，瀏覽器呈現完全破圖（Chrome DevTools 顯示 `<svg aria-label="risk">` 警告圖標，HTML 標籤為 `<img alt="石君鴿舍" src="/_next/image?url=%2Fimages%2Flogo.png&w=3840&q=75" ...>`）。

### 根本原因分析

1. **第一層錯誤：鴿舍圖片路徑寫死錯誤**
   - 合作鴿舍圖片上傳時儲存在 `uploads/homepage-sections/`，其 URL 產生器為 `lib/uploads.ts` 的 `homepageSectionImageUrl(...)`。
   - `app/[locale]/listings/(with-loading)/page.tsx`（橫幅頭像及 SEO metadata）與 `app/[locale]/listings/(no-loading)/[id]/page.tsx`（拍品價格卡片鴿舍頭像）直接寫死 `/uploads/sections/${fileName}`。
   - 伺服器端請求 `/uploads/sections/...` 回傳 404 Not Found（正確路徑 `/uploads/homepage-sections/...` 可正常取得 200 OK）。

2. **第二層錯誤：後備圖（Fallback）觸發 Next.js Image Optimizer 報 502**
   - 當原圖 404 觸發 `PartnerLoftImage` 的 `onError` 時，`useImageFallback` 會切換為備用圖 `IMAGE_FALLBACK_SRC = "/images/logo.png"`。
   - `shouldBypassImageOptimizer` 僅檢查是否包含 `/uploads/`，對 `/images/logo.png` 回傳 `false`，導致 Next.js 生成 `/_next/image?url=%2Fimages%2Flogo.png...`。
   - 本站部署架構（LiteSpeed PHP-FPM 反向代理 + Cloudflare）下，Next.js 的 `/_next/image` 端點在向自身發起內部 fetch 請求時因回環/逾時失敗，Cloudflare 回傳 502 Bad Gateway，導致備用圖也無法顯示。

## 2. 解決方案與規格

1. **修正上傳路徑引用**
   - 在 `app/[locale]/listings/(with-loading)/page.tsx` 引入 `homepageSectionImageUrl`，將 `selectedLoft.imageFileName` 的路徑替換為 `homepageSectionImageUrl(selectedLoft.imageFileName)`。
   - 在 `app/[locale]/listings/(no-loading)/[id]/page.tsx` 引入 `homepageSectionImageUrl`，將 `loft.imageFileName` 的路徑替換為 `homepageSectionImageUrl(loft.imageFileName)`。

2. **防止後備圖進入 Next Optimizer**
   - 在 `lib/imageFallback.ts` 中更新 `shouldBypassImageOptimizer`，使 `IMAGE_FALLBACK_SRC` 以及 `/images/` 前綴的靜態資產一律繞過 Next.js optimizer（`unoptimized: true`）。
   - 在 `next.config.js` 中設定 `images: { unoptimized: true }`，本站所有上傳圖片早已在使用者端或後端轉為 WebP，靜態資源直接由 Web 伺服器/CDN 高速回應，全面關閉 Node 端 Image Optimizer，徹底避免 502 逾時與 OOM 記憶體飆升風險。
   - 在 `app/[locale]/components/SiteHeader.tsx` 的 `<Image>` 明確加上 `unoptimized` 屬性。

3. **同步規格與測試**
   - 更新 `docs/specs/loft-detail-and-storefront.md` 中的圖片路徑為 `/uploads/homepage-sections/{imageFileName}`。
   - 更新 `lib/imageFallback.test.ts`，確認 `IMAGE_FALLBACK_SRC` 與 `/images/logo.png` 均正確 bypass optimizer。

## 3. 驗證標準
- `npx tsc --noEmit`：0 errors
- `npm test`：全部測試通過（83 files, 824 tests）
- `npm run build`：成功編譯
- 正式站部署後測試 `https://xiangshuicn.cc/listings?loft=2` 與 `https://xiangshuicn.cc/images/logo.png` 均正常返回 200。
