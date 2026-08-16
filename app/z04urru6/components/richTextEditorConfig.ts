import { COLOR_MAP } from "@/lib/editorColorMap";

// 兩個自架 TinyMCE 包裝元件（listings/DescriptionEditor.tsx 的完整版、
// components/SimpleRichTextEditor.tsx 給最新訊息／入賞鴿-進口鴿用的精簡版）
// 共用的基礎設定，原本兩邊各自逐字複製一份約 30 行（issue #139 M27）。
// 各自的 plugins/toolbar/images_upload_handler/setup 等差異部分由呼叫端疊加。

/** 自架 TinyMCE 靜態檔位置，兩個編輯器都指向同一份 self-host 資源。 */
export const TINYMCE_SCRIPT_SRC = "/tinymce/tinymce.min.js";

/** 自架部署一律用 GPL 授權，不呼叫 Tiny 雲端服務。 */
export const TINYMCE_LICENSE_KEY = "gpl";

/**
 * 兩個編輯器共用的 init 基礎設定。個別編輯器需要在此之上疊加
 * `height`/`plugins`/`toolbar` 等專屬設定：
 * `{ ...TINYMCE_BASE_INIT, height: 320, plugins: "...", toolbar: "..." }`。
 */
export const TINYMCE_BASE_INIT = {
  menubar: false,
  branding: false,
  promotion: false,
  language: "zh-TW",
  // Native statusbar would duplicate the custom char counter each editor
  // renders below itself.
  statusbar: false,
  block_formats: "段落=p; 標題=h2; 副標題=h3",
  color_map: COLOR_MAP,
} as const;
