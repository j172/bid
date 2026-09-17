import type { Editor as TinyMCEEditor } from "tinymce";
import { extractYouTubeId } from "@/lib/youtubeEmbed";

// Shared "插入 YouTube 影片" toolbar button registration behind both
// app/z04urru6/listings/DescriptionEditor.tsx and
// ./SimpleRichTextEditor.tsx (issue #315 gave the latter this button too) —
// extracted here so the two editors' YouTube-insert behavior can't drift
// apart, same "shared setup, callers register it in their own TinyMCE
// `setup` callback" split as richTextEditorConfig.ts's base init. Restricted
// to YouTube only (see extractYouTubeId) rather than TinyMCE's built-in media
// plugin, whose multi-tab UI accepts raw embed code / arbitrary source URLs.
export function registerInsertYoutubeButton(editor: TinyMCEEditor): void {
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
}
