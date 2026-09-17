"use client";

// TinyMCE 包裝，最新訊息（內容）、入賞鴿／進口鴿／代表種鴿／世界名鴿（簡介）、
// 名家專區（內容）共用。原本是同一份設定的複製體、只差字數上限常數
// （issue #139 H3），issue #315 再補上插入影片／插入圖片，跟
// app/z04urru6/listings/DescriptionEditor.tsx 的完整版看齊——四種內容類型都
// 各自有自己的 uploads/<entityType>/<id>/description/ 端點了（見
// lib/uploads.ts 的 saveDescriptionImages），當初拿掉 image plugin 的理由已不成立。

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { descriptionPlainTextLength } from "@/lib/listingValidation";
import { createDescriptionImagesUploadHandler, extractDescriptionImagesForSubmit } from "./descriptionImageUpload";
import { registerInsertYoutubeButton } from "./insertYoutubeButton";
import { TINYMCE_BASE_INIT, TINYMCE_LICENSE_KEY, TINYMCE_SCRIPT_SRC } from "./richTextEditorConfig";

export interface SimpleRichTextEditorHandle {
  // Called at form-submit time: swaps every locally-buffered image's blob:
  // URL for a `cid:N` placeholder the server can match against the
  // like-ordered `descriptionImages` files, and returns the resulting HTML.
  // Nothing is uploaded before this is called — see images_upload_handler below.
  extractForSubmit(): { html: string; images: File[] };
}

interface SimpleRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  maxLength: number;
  error?: string | null;
}

const SimpleRichTextEditor = forwardRef<SimpleRichTextEditorHandle, SimpleRichTextEditorProps>(
  function SimpleRichTextEditor({ value, onChange, maxLength, error }, ref) {
    const editorRef = useRef<TinyMCEEditor | null>(null);
    const pendingImagesRef = useRef<Map<string, File>>(new Map());

    useImperativeHandle(ref, () => ({
      extractForSubmit() {
        return extractDescriptionImagesForSubmit(value, pendingImagesRef.current);
      },
    }));

    const plainTextLength = descriptionPlainTextLength(value);
    const counterClass = `text-xs ${plainTextLength > maxLength ? "text-ended" : "text-ink-light"}`;

    return (
      <div className="flex flex-col gap-1">
        <Editor
          tinymceScriptSrc={TINYMCE_SCRIPT_SRC}
          licenseKey={TINYMCE_LICENSE_KEY}
          value={value}
          onEditorChange={onChange}
          onInit={(_event, editor) => {
            editorRef.current = editor;
          }}
          init={{
            ...TINYMCE_BASE_INIT,
            height: 320,
            plugins: "lists link image table fullscreen searchreplace code",
            toolbar:
              "undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | " +
              "alignleft aligncenter alignright | bullist numlist | blockquote hr | link image insertyoutube table removeformat | " +
              "searchreplace fullscreen code",
            setup: registerInsertYoutubeButton,
            // Same "buffer as a local blob: URL, upload only at form-submit
            // time" story as DescriptionEditor.tsx — see
            // createDescriptionImagesUploadHandler's own comment.
            images_upload_handler: createDescriptionImagesUploadHandler(editorRef, pendingImagesRef),
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
  },
);

export default SimpleRichTextEditor;
