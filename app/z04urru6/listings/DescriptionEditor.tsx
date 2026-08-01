"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { DESCRIPTION_IMAGE_MAX_BYTES, DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { DESCRIPTION_MAX, descriptionPlainTextLength } from "@/lib/listingValidation";

// Fixed brand palette (mirrors the --color-* tokens in app/globals.css) so
// seller-authored descriptions can't introduce colors that clash with the
// site's own design — free-form colors baked into stored HTML can't be
// swept up by a future CSS-only redesign.
const COLOR_MAP = [
  "010F1C", "文字黑",
  "5A6270", "淺灰",
  "0989FF", "品牌藍",
  "0672D8", "深藍",
  "15803D", "綠（強調）",
  "B91C1C", "紅（強調）",
  "FFFFFF", "白",
];

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
}

const DescriptionEditor = forwardRef<DescriptionEditorHandle, DescriptionEditorProps>(function DescriptionEditor(
  { value, onChange, error },
  ref,
) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const pendingImagesRef = useRef<Map<string, File>>(new Map());

  useImperativeHandle(ref, () => ({
    extractForSubmit() {
      const doc = new DOMParser().parseFromString(value, "text/html");
      const images: File[] = [];
      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") ?? "";
        const file = pendingImagesRef.current.get(src);
        if (file) {
          img.setAttribute("src", `cid:${images.length}`);
          images.push(file);
        }
      });
      return { html: doc.body.innerHTML, images };
    },
  }));

  const plainTextLength = descriptionPlainTextLength(value);
  const counterClass = `text-xs ${plainTextLength > DESCRIPTION_MAX ? "text-ended" : "text-ink-light"}`;

  return (
    <div className="flex flex-col gap-1">
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        value={value}
        onEditorChange={onChange}
        onInit={(_event, editor) => {
          editorRef.current = editor;
        }}
        init={{
          height: 360,
          menubar: false,
          branding: false,
          promotion: false,
          plugins: "lists link image table",
          toolbar:
            "undo redo | blocks fontsize | bold italic underline | forecolor backcolor | " +
            "alignleft aligncenter alignright | bullist numlist | link image table | removeformat",
          block_formats: "段落=p; 標題=h2; 副標題=h3",
          color_map: COLOR_MAP,
          // Images are never uploaded to a server endpoint here — the handler
          // below intercepts every insert, converts it client-side, and hands
          // back a local blob: URL for display. The real file only leaves the
          // browser when the surrounding listing form is submitted.
          images_upload_handler: (blobInfo) =>
            new Promise<string>((resolve, reject) => {
              const liveCount =
                editorRef.current?.getBody().querySelectorAll('img[src^="blob:"]').length ?? pendingImagesRef.current.size;
              if (liveCount >= DESCRIPTION_IMAGE_MAX_COUNT) {
                reject(`描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張`);
                return;
              }
              const original = new File([blobInfo.blob()], blobInfo.filename(), { type: blobInfo.blob().type });
              convertPhotoToWebp(original).then((converted) => {
                if (converted.size > DESCRIPTION_IMAGE_MAX_BYTES) {
                  reject(`圖片超過單檔 ${DESCRIPTION_IMAGE_MAX_BYTES / 1024 / 1024}MB 上限`);
                  return;
                }
                const url = URL.createObjectURL(converted);
                pendingImagesRef.current.set(url, converted);
                resolve(url);
              });
            }),
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
