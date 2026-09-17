"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { DESCRIPTION_MAX, descriptionPlainTextLength } from "@/lib/listingValidation";
import { createDescriptionImagesUploadHandler, extractDescriptionImagesForSubmit } from "../components/descriptionImageUpload";
import { registerInsertYoutubeButton } from "../components/insertYoutubeButton";
import { TINYMCE_BASE_INIT, TINYMCE_LICENSE_KEY, TINYMCE_SCRIPT_SRC } from "../components/richTextEditorConfig";

export interface DescriptionEditorHandle {
  // Called at form-submit time: swaps every locally-buffered image's blob:
  // URL for a `cid:N` placeholder the server can match against the
  // like-ordered `descriptionImages` files, and returns the resulting HTML.
  // Nothing is uploaded before this is called — see images_upload_handler below.
  extractForSubmit(): { html: string; images: File[] };
}

interface DescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  error?: string | null;
  /**
   * Set false to omit the image-insert toolbar button/plugin (and its
   * upload handler) while keeping everything else, including the "插入
   * YouTube 影片" button. No current caller sets this — every content type
   * that reuses this editor (listings, products since issue #315) now has
   * its own description-image upload path — but it's kept available rather
   * than removed, since a future rich-text field without one (same shape as
   * ProductFormModal's pre-#315 situation) would need it again. Defaults to
   * true.
   */
  enableImages?: boolean;
}

const DescriptionEditor = forwardRef<DescriptionEditorHandle, DescriptionEditorProps>(function DescriptionEditor(
  { value, onChange, error, enableImages = true },
  ref,
) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const pendingImagesRef = useRef<Map<string, File>>(new Map());

  useImperativeHandle(ref, () => ({
    extractForSubmit() {
      return extractDescriptionImagesForSubmit(value, pendingImagesRef.current);
    },
  }));

  const plainTextLength = descriptionPlainTextLength(value);
  const counterClass = `text-xs ${plainTextLength > DESCRIPTION_MAX ? "text-ended" : "text-ink-light"}`;

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
          height: 360,
          plugins: enableImages ? "lists link image table fullscreen searchreplace code" : "lists link table fullscreen searchreplace code",
          toolbar:
            "undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | " +
            "alignleft aligncenter alignright alignjustify | bullist numlist | blockquote hr | " +
            `subscript superscript codeformat | link ${enableImages ? "image " : ""}insertyoutube table | removeformat | ` +
            "searchreplace fullscreen code",
          setup: registerInsertYoutubeButton,
          // Images are never uploaded to a server endpoint here — the handler
          // below intercepts every insert, converts it client-side, and hands
          // back a local blob: URL for display. The real file only leaves the
          // browser when the surrounding listing form is submitted.
          images_upload_handler: createDescriptionImagesUploadHandler(editorRef, pendingImagesRef),
        }}
      />
      <div className="flex items-center justify-between">
        <span>{error && <span className="text-sm text-ended">{error}</span>}</span>
        <span className={counterClass}>
          {plainTextLength}/{DESCRIPTION_MAX}
        </span>
      </div>
    </div>
  );
});

export default DescriptionEditor;
