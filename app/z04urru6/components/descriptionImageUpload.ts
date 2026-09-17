import type { RefObject } from "react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { DESCRIPTION_IMAGE_MAX_BYTES, DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";

// Shared client-side "insert an image, buffer it as a local blob: URL,
// upload only at form-submit time" implementation behind both
// app/z04urru6/listings/DescriptionEditor.tsx and ./SimpleRichTextEditor.tsx
// (issue #315 gave the latter image support too). Extracted here rather than
// duplicated so the two editors' image handling can't silently diverge — see
// extractDescriptionImagesForSubmit for the matching form-submit-time half.
//
// Only the two BlobInfo methods actually used are declared (TinyMCE's own
// BlobInfo type isn't exported from the package) — structurally compatible
// with the real BlobInfo TinyMCE passes in, since it has strictly more
// methods than this.
export interface DescriptionImageBlobInfo {
  blob(): Blob;
  filename(): string;
}

export function createDescriptionImagesUploadHandler(
  editorRef: RefObject<TinyMCEEditor | null>,
  pendingImagesRef: RefObject<Map<string, File>>,
): (blobInfo: DescriptionImageBlobInfo) => Promise<string> {
  return (blobInfo) =>
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
    });
}

// Called at form-submit time (DescriptionEditorHandle.extractForSubmit /
// SimpleRichTextEditorHandle.extractForSubmit): swaps every locally-buffered
// image's blob: URL for a `cid:N` placeholder the server can match against
// the like-ordered `descriptionImages` files the form sends alongside.
// Nothing is uploaded before this runs.
export function extractDescriptionImagesForSubmit(
  html: string,
  pendingImages: Map<string, File>,
): { html: string; images: File[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images: File[] = [];
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const file = pendingImages.get(src);
    if (file) {
      img.setAttribute("src", `cid:${images.length}`);
      images.push(file);
    }
  });
  return { html: doc.body.innerHTML, images };
}
