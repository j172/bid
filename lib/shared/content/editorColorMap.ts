// Fixed brand palette (mirrors the --color-* tokens in app/globals.css), shared
// by every TinyMCE instance's forecolor/backcolor picker so admin-authored
// content can't introduce colors that clash with the site's own design —
// free-form colors baked into stored HTML can't be swept up by a future
// CSS-only redesign.
export const COLOR_MAP = [
  "010F1C", "文字黑",
  "5A6270", "淺灰",
  "73903C", "品牌綠",
  "566C2D", "深綠",
  "15803D", "綠（強調）",
  "B91C1C", "紅（強調）",
  "FFFFFF", "白",
];
