// 後台表單 modal 觸發按鈕的兩種樣式：新增用主要（實心）樣式，編輯／其他次要
// 操作用外框樣式。這組三元式在 NewsFormModal / PigeonShowcaseFormModal /
// PartnerLoftFormModal 三個檔案逐字重複，EditListingModal／EditScheduleModal
// 的單一觸發按鈕也是同一個次要樣式的字串（issue #139 M26 / M30）。

export const PRIMARY_TRIGGER_CLASS =
  "rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active";

export const SECONDARY_TRIGGER_CLASS =
  "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted";

/** 新增／編輯共用一個觸發按鈕時，依 isEdit 挑選對應樣式。 */
export function MODAL_TRIGGER_CLASS(isEdit: boolean): string {
  return isEdit ? SECONDARY_TRIGGER_CLASS : PRIMARY_TRIGGER_CLASS;
}
