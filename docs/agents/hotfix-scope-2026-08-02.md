# Hotfix Scope — 2026-08-02

目的：只針對 502 / `starts_at` schema drift 事故進行最小風險上線。

## 建議納入（必要）

- `lib/listings.ts`
  - 缺少 `starts_at` 欄位時的執行期 fallback（避免直接 5xx）。
- `lib/db.ts`
  - 啟動時自動補 `listings.starts_at` 與 `idx_listings_status_starts`。

## 建議納入（本次分支為了通過 build 的相依修補）

- `app/[locale]/dev-preview-hero-countdown/page.tsx`
  - 補上 `renderedAt` props，修正本分支現有型別要求造成的 build fail。

## 文件（可選）

- `docs/agents/502-origin-recovery-runbook.md`
  - 事故應變手冊，不影響執行邏輯。

## 不建議與本 hotfix 同批上線

- 大量 UI 色彩與樣式調整（多個 `app/[locale]/*`、`app/z04urru6/*`、`messages/*`、`design-tokens.css` 等）
- 倒數條/共用 countdown hook 功能性新增（`HeroCountdownStrip.tsx`、`useListingCountdown.ts`、多頁 props 串接）

理由：這些變更與 502 根因無直接關聯，混批會放大回歸面積。

## 當前狀態

- `npm test` 通過（100/100）
- `npm run build` 通過
- 公網檢查：`/api/health` 與首頁皆回 200
