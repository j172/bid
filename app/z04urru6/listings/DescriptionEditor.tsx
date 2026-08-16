"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { DESCRIPTION_IMAGE_MAX_BYTES, DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { DESCRIPTION_MAX, descriptionPlainTextLength } from "@/lib/listingValidation";
import { extractYouTubeId } from "@/lib/youtubeEmbed";
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
          plugins: "lists link image table fullscreen searchreplace code",
          toolbar:
            "undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | " +
            "alignleft aligncenter alignright alignjustify | bullist numlist | blockquote hr | " +
            "subscript superscript codeformat | link image insertyoutube table | removeformat | " +
            "searchreplace fullscreen code",
          setup: (editor) => {
            editor.ui.registry.addButton("insertyoutube", {
              icon: "embed",
              tooltip: "插入 YouTube 影片",
              onAction: () => {
                editor.windowManager.open({
                  title: "插入 YouTube 影片",
                  body: {
                    type: "panel",
                    items: [
                      {
                        type: "input",
                        name: "url",
                        label: "YouTube 網址",
                        placeholder: "https://www.youtube.com/watch?v=...",
                      },
                    ],
                  },
                  initialData: { url: "" },
                  buttons: [
                    { type: "cancel", text: "取消" },
                    { type: "submit", text: "插入", primary: true },
                  ],
                  onSubmit: (api) => {
                    const videoId = extractYouTubeId(String(api.getData().url));
                    if (!videoId) {
                      editor.notificationManager.open({ text: "請輸入有效的 YouTube 網址", type: "error" });
                      return;
                    }
                    editor.insertContent(
                      `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" width="560" height="315" ` +
                        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
                        `allowfullscreen title="YouTube video player" frameborder="0"></iframe>`,
                    );
                    api.close();
                  },
                });
              },
            });
          },
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
