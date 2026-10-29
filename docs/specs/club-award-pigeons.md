# Spec: 新增「各地鴿會入賞鴿」專區與相簿分類管理

## 1. Outcome

提供獨立於既有「世界名鴿介紹專區」與「鴿種介紹專區」的 **「各地鴿會入賞鴿」** 專區與相簿分類管理體系：
- 管理員可於後台獨立管理「各地鴿會相簿名稱」與「各地鴿會入賞鴿」資料。
- 前台訪客可在首頁「世界名鴿介紹專區」下方瀏覽「各地鴿會入賞鴿」相簿卡片、查看全部相簿清單、點擊相簿檢視歸類於該相簿的入賞鴿卡片列表，並點入檢視單羽入賞鴿詳情頁。

---

## 2. Scope

### 2.1 資料庫 Schema (`db/init.sql` & `lib/db.ts`)

新增兩張與 `pigeon_showcase` 完全獨立的資料表（使用 `CREATE TABLE IF NOT EXISTS`）：

1. **`club_award_albums`（各地鴿會入賞鴿相簿）**：
   - `id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY`
   - `name VARCHAR(100) NOT NULL`
   - `created_at DATETIME NOT NULL`
   - `updated_at DATETIME NOT NULL`
   - `KEY idx_club_award_albums_created (created_at)`

2. **`club_award_pigeons`（各地鴿會入賞鴿）**：
   - `id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY`
   - `album_id BIGINT NOT NULL`（FK 指向 `club_award_albums(id)`，`ON DELETE RESTRICT ON UPDATE RESTRICT`）
   - `category ENUM('award','imported','representative','world_famous') NOT NULL`
   - `name VARCHAR(100) NOT NULL`
   - `loft_id BIGINT NULL`（選填，FK 指向 `homepage_sections(id)`，`ON DELETE RESTRICT ON UPDATE RESTRICT`）
   - `photo_source VARCHAR(100) NULL`
   - `image_file_name VARCHAR(255) NOT NULL`
   - `description TEXT NOT NULL`
   - `created_at DATETIME NOT NULL`
   - `updated_at DATETIME NOT NULL`
   - `KEY idx_club_award_pigeons_album_created (album_id, created_at)`
   - `KEY idx_club_award_pigeons_category_created (category, created_at)`
   - `KEY idx_club_award_pigeons_loft (loft_id)`

### 2.2 後端模組與上傳 (`lib/`)

- **`lib/clubAwardPigeonsValidation.ts` & `lib/clubAwardPigeonsValidation.test.ts`**：
  - `ALBUM_NAME_MAX = 100`，`validateClubAwardAlbumName(name)` 驗證相簿名稱必填且不超過 100 字。
  - 複用 `lib/pigeonShowcaseValidation.ts` 的 `PIGEON_SHOWCASE_CATEGORIES`、`validatePigeonShowcaseName`、`validatePigeonShowcaseDescription`、`validatePigeonShowcasePhotoSource`。
- **`lib/clubAwardPigeons.ts` & `lib/clubAwardPigeons.test.ts`**：
  - 相簿 CRUD：
    - `listClubAwardAlbums({ search, page, pageSize })` 與 `listLatestClubAwardAlbums(limit)`：回傳每本相簿的 `id, name, pigeonCount, coverImageFileName, createdAt, updatedAt`（`coverImageFileName` 取該相簿最新一筆 `club_award_pigeons` 的 `image_file_name`，無鴿子時為 `null`）。
    - `listAllClubAwardAlbums()`：回傳所有相簿（依建立時間最新優先排序）。
    - `getClubAwardAlbumById(id)`、`createClubAwardAlbum(name)`、`updateClubAwardAlbum(id, name)`。
    - `deleteClubAwardAlbum(id)`：先檢查 `club_award_pigeons` 中是否有 `album_id = id` 的資料；若有 `count > 0`，回傳 `{ ok: false, error: "此相簿尚有 N 筆鴿子資料，請先刪除或移轉相簿內的鴿子後再刪除" }`，禁止直接刪除。
  - 入賞鴿 CRUD：
    - `listClubAwardPigeons({ albumId, category, search, loftId, page, pageSize })`（JOIN `club_award_albums` 取得 `albumTitle`，LEFT JOIN `homepage_sections` 取得 `loftTitle`）。
    - `listLatestClubAwardPigeonsByAlbum(albumId, limit)`。
    - `getClubAwardPigeonById(id)`、`createClubAwardPigeon(input)`（`loftId` 可為 `null`；有傳入時驗證是否為 `partner_loft`；並驗證 `albumId` 是否存在）、`updateClubAwardPigeon(id, input)`、`updateClubAwardPigeonDescription(id, description)`、`deleteClubAwardPigeon(id)`。
- **`lib/uploads.ts` & `lib/uploads.test.ts`**：
  - `DescriptionImageEntityType` 新增 `"club-award-pigeons"`。
  - 新增 `saveClubAwardPigeonImage`、`clubAwardPigeonImageUrl`、`deleteClubAwardPigeonImageFile`（目錄：`uploads/club-award-pigeons`）。

### 2.3 後台管理功能 (`app/z04urru6/` & `app/api/admin/`)

1. **導覽選單（`app/z04urru6/adminNav.ts` & `app/z04urru6/AdminShell.tsx`）**：
   - 在「鴿種介紹專區」下方依序加入：
     - `{ label: "各地鴿會相簿管理", href: "/z04urru6/club-award-albums", section: "content" }`
     - `{ label: "各地鴿會入賞鴿", href: "/z04urru6/club-award-pigeons", section: "content" }`
2. **各地鴿會相簿管理（`/z04urru6/club-award-albums` & `/api/admin/club-award-albums`）**：
   - 列表顯示：相簿名稱、鴿子數量、建立時間、操作（編輯、刪除）。
   - 支援相簿名稱關鍵字搜尋與分頁（30/50/100）。
   - 新增／編輯 Modal 僅需填寫「相簿名稱」。
3. **各地鴿會入賞鴿管理（`/z04urru6/club-award-pigeons` & `/api/admin/club-award-pigeons`）**：
   - 篩選列：相簿名稱、鴿種（全部／入賞鴿／進口鴿／代表種鴿／世界名鴿）、名稱搜尋、鴿舍、每頁筆數（30/50/100）。
   - 列表欄位：主圖、相簿名稱、鴿種、名稱、鴿舍、照片來源、簡介、操作（編輯、刪除）。
   - 新增／編輯 Modal：
     - 相簿名稱（必選下拉選單；若尚無任何相簿則提示先至「各地鴿會相簿管理」建立）
     - 鴿種（入賞鴿／進口鴿／代表種鴿／世界名鴿，必選）
     - 名稱（必填）
     - 鴿舍（選填／可不填）
     - 照片來源（未指定／三豐攝影／舍內自拍／其他）
     - 主圖（必填）
     - 簡介（TinyMCE 富文本，支援內嵌圖片，必填）

### 2.4 前台頁面與多語系 (`app/[locale]/` & `messages/`)

1. **首頁「各地鴿會入賞鴿」區塊（`app/[locale]/(with-loading)/page.tsx`）**：
   - 位於「世界名鴿介紹專區」正下方，版型與「世界名鴿介紹專區」完全一致（最多 6 張卡片、3 欄網格、空狀態顯示「即將推出」）。
   - 每張卡片代表一本相簿：上方顯示相簿封面圖（取該相簿最新一羽鴿子的主圖，無鴿子時顯示 `IMAGE_FALLBACK_SRC`），下方顯示相簿名稱與「共 N 羽入賞鴿」。
   - 點擊相簿卡片前往 `/club-award-pigeons?albumId=<id>`；點擊區塊右上角「查看全部」前往 `/club-award-pigeons`。
2. **各地鴿會入賞鴿相簿列表／相簿內鴿子列表頁（`app/[locale]/club-award-pigeons/page.tsx`）**：
   - 未帶有效 `albumId` 時：顯示所有相簿卡片網格與分頁，點擊任一相簿進入 `/club-award-pigeons?albumId=<id>`。
   - 帶有有效 `albumId` 時：標題顯示該相簿名稱，上方提供「全部相簿」與各相簿切換膠囊按鈕，下方使用 `ContentCardGrid` 與 `PaginationFooter` 列出該相簿內的所有鴿子卡片（點選進入 `/club-award-pigeons/[id]`）。
3. **各地鴿會入賞鴿詳情頁（`app/[locale]/(no-loading)/club-award-pigeons/[id]/page.tsx`）**：
   - 版型與 `/pigeon-showcase/[id]` 一致（使用 `DetailWithSidebar` 與 `RichTextContent`）。
   - 麵包屑：`首頁 / 各地鴿會入賞鴿 / <相簿名稱> / <鴿名>`。
   - 主欄顯示：主圖、鴿種標籤、鴿名、相簿連結、鴿舍連結（若有）、照片來源（若有）、富文本簡介。
   - 側邊欄顯示：同相簿最新入賞鴿（最多 5 筆）。

---

## 3. Non-goals

- 不修改或影響既有的「世界名鴿介紹專區」與「鴿種介紹專區」（`pigeon_showcase` 資料表與其前後台路由維持原狀）。
- 不將「各地鴿會入賞鴿」的資料混入首頁上方的入賞鴿／進口鴿／代表種鴿輪播或三豐攝影名鴿特輯。
- 相簿本身不額外要求管理員上傳獨立相簿封面圖（自動取相簿內最新一羽鴿子的主圖作為封面）。

---

## 4. Acceptance Criteria

- [ ] AC1: `db/init.sql` 與 `lib/db.ts` 定義 `club_award_albums` 與 `club_award_pigeons` 資料表，與 `pigeon_showcase` 完全獨立。
- [ ] AC2: 後台「各地鴿會相簿管理」（`/z04urru6/club-award-albums`）支援新增、編輯、搜尋、分頁與刪除相簿，且當相簿內仍有鴿子時禁止刪除並回傳明確錯誤提示。
- [ ] AC3: 後台「各地鴿會入賞鴿」（`/z04urru6/club-award-pigeons`）支援依相簿、鴿種、名稱、鴿舍篩選，且新增／編輯表單包含必選「相簿名稱」、必選「鴿種」、選填「鴿舍」、選填「照片來源」、必填「主圖」與必填「簡介」。
- [ ] AC4: 前台首頁於「世界名鴿介紹專區」下方顯示「各地鴿會入賞鴿」相簿區塊，點擊相簿進入該相簿的入賞鴿列表頁（`/club-award-pigeons?albumId=<id>`），再點擊鴿子進入詳情頁（`/club-award-pigeons/[id]`），且 `zh-TW`、`zh-CN`、`en` 三語系翻譯完整。
- [ ] AC5: 單元測試、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全部通過。

---

## 5. Risks & Rollout

- **Migration / Compatibility**: 僅新增 `club_award_albums` 與 `club_award_pigeons` 兩張表（`CREATE TABLE IF NOT EXISTS`），不修改任何既有資料表結構，對現有功能與資料零破壞性。
- **Deployment**: 合併至 `master` 後由 `.github/workflows/deploy-ftps.yml` 自動部署，應用程式啟動時 `getDb()` 會自動執行 `CREATE TABLE IF NOT EXISTS` 建立新資料表。
- **Rollback**: 若需回滾，直接透過 PR revert 程式碼並重新部署即可；新建立的兩張資料表留在資料庫中不會影響舊版程式運作。

---

## 6. Verification

- 單元測試：`npx vitest run lib/clubAwardPigeonsValidation.test.ts lib/clubAwardPigeons.test.ts lib/uploads.test.ts`
- 全域檢查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
- 正式站部署驗證：確認 `.github/workflows/deploy-ftps.yml` 執行成功並通過遠端健康檢查。
