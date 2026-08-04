"use client";

import { useRef, useState } from "react";
import DescriptionEditor, { type DescriptionEditorHandle } from "@/app/z04urru6/listings/DescriptionEditor";
import PhotoGalleryEditor, { type PhotoItem } from "@/app/z04urru6/listings/PhotoGalleryEditor";
import { usePartnerLofts } from "@/app/z04urru6/listings/usePartnerLofts";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

// Full multi-photo/description editor for a single gallery item (issue #49)
// — a modal rather than ItemManager's old inline table-row editing, since
// there's no longer room in a table cell for PhotoGalleryEditor + a TinyMCE
// DescriptionEditor. Mirrors app/z04urru6/listings/EditListingModal.tsx's
// "fetch full detail on open, submit as FormData" shape closely.
export default function EditGalleryItemModal({
  itemId,
  sortOrder,
  onSaved,
}: {
  itemId: number;
  sortOrder: number;
  onSaved: () => void;
}) {
  const descriptionEditorRef = useRef<DescriptionEditorHandle>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loftId, setLoftId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lofts = usePartnerLofts();

  async function handleOpen() {
    setOpen(true);
    if (loaded) return;

    setLoading(true);
    setLoadError(null);
    const response = await fetch(`/api/admin/pigeon-gallery/items/${itemId}`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setLoadError(data.error ?? "讀取失敗");
      return;
    }
    setTitle(data.item.title);
    setDescription(data.item.description ?? "");
    setLoftId(data.item.loftId ? String(data.item.loftId) : "");
    setIsActive(data.item.isActive);
    setPhotoItems(
      data.item.photos.map((photo: { fileName: string; url: string }) => ({
        kind: "existing" as const,
        fileName: photo.fileName,
        url: photo.url,
      })),
    );
    setLoaded(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { html: descriptionHtml, images: descriptionImages } = descriptionEditorRef.current!.extractForSubmit();

    let newIndex = 0;
    const order = photoItems.map((item) =>
      item.kind === "existing" ? { type: "existing", fileName: item.fileName } : { type: "new", index: newIndex++ },
    );

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", descriptionHtml);
    formData.set("loftId", loftId);
    formData.set("sortOrder", String(sortOrder));
    formData.set("isActive", isActive ? "true" : "false");
    formData.set("order", JSON.stringify(order));
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }
    for (const image of descriptionImages) {
      formData.append("descriptionImages", image);
    }

    const response = await fetch(`/api/admin/pigeon-gallery/items/${itemId}`, { method: "PATCH", body: formData });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "更新失敗");
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
      >
        編輯
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">編輯展示鴿項目</h2>

            {loading && <p className="mt-4 text-sm text-ink-light">載入中...</p>}
            {loadError && <p className="mt-4 text-sm text-ended">{loadError}</p>}

            {loaded && (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  標題
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  合作鴿舍（選填）
                  <select value={loftId} onChange={(e) => setLoftId(e.target.value)} className={inputClass}>
                    <option value="">無</option>
                    {lofts.map((loft) => (
                      <option key={loft.id} value={loft.id}>
                        {loft.title}
                      </option>
                    ))}
                  </select>
                </label>

                <PhotoGalleryEditor items={photoItems} onChange={setPhotoItems} />

                <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  描述（選填）
                  <DescriptionEditor ref={descriptionEditorRef} value={description} onChange={setDescription} />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  上架顯示
                </label>

                {error && <p className="text-sm text-ended">{error}</p>}
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || photoItems.length === 0}
                    className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
