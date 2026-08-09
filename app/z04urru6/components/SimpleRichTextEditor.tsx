"use client";

// 精簡版的 TinyMCE 包裝，最新訊息（內容）與入賞鴿／進口鴿（簡介）共用。
// 兩者原本是同一份設定的複製體、只差字數上限常數（issue #139 H3）。
//
// 與 app/z04urru6/listings/DescriptionEditor.tsx 一樣採自架 TinyMCE
// （tinymceScriptSrc="/tinymce/tinymce.min.js"、licenseKey="gpl"），但刻意
// 拿掉圖片上傳：news_posts / pigeon_showcase 都沒有各自的圖片儲存端點
// （不像 listings 會連同照片一起上傳描述圖），與其接一個不存在的上傳流程，
// 不如整個 "image" plugin 都不要載入。

import { Editor } from "@tinymce/tinymce-react";
import { COLOR_MAP } from "@/lib/editorColorMap";
import { descriptionPlainTextLength } from "@/lib/listingValidation";

export default function SimpleRichTextEditor({
  value,
  onChange,
  maxLength,
  error,
}: {
  value: string;
  onChange: (html: string) => void;
  maxLength: number;
  error?: string | null;
}) {
  const plainTextLength = descriptionPlainTextLength(value);
  const counterClass = `text-xs ${plainTextLength > maxLength ? "text-ended" : "text-ink-light"}`;

  return (
    <div className="flex flex-col gap-1">
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        value={value}
        onEditorChange={onChange}
        init={{
          height: 320,
          menubar: false,
          branding: false,
          promotion: false,
          language: "zh-TW",
          // Native statusbar would duplicate the custom counter below.
          statusbar: false,
          plugins: "lists link table fullscreen searchreplace code",
          toolbar:
            "undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | " +
            "alignleft aligncenter alignright | bullist numlist | blockquote hr | link table removeformat | " +
            "searchreplace fullscreen code",
          block_formats: "段落=p; 標題=h2; 副標題=h3",
          color_map: COLOR_MAP,
        }}
      />
      <div className="flex items-center justify-between">
        <span>{error && <span className="text-sm text-ended">{error}</span>}</span>
        <span className={counterClass}>
          {plainTextLength}/{maxLength}
        </span>
      </div>
    </div>
  );
}
