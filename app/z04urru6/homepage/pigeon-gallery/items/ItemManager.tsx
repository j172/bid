"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DescriptionEditor, { type DescriptionEditorHandle } from "@/app/z04urru6/listings/DescriptionEditor";
import PhotoGalleryEditor, { type PhotoItem } from "@/app/z04urru6/listings/PhotoGalleryEditor";
import { usePartnerLofts } from "@/app/z04urru6/listings/usePartnerLofts";
import EditGalleryItemModal from "./EditGalleryItemModal";

interface ItemRow {
  id: number;
  categoryId: number;
  title: string;
  imageFileName: string;
  imageUrl: string;
  loftId: number | null;
  sortOrder: number;
  isActive: boolean;
}

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm align-top";
const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export default function ItemManager({ categoryId }: { categoryId: number }) {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lofts = usePartnerLofts();

  const descriptionEditorRef = useRef<DescriptionEditorHandle>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newLoftId, setNewLoftId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotoItems, setNewPhotoItems] = useState<PhotoItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/admin/pigeon-gallery/items?categoryId=${categoryId}`);
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setItems(data.items);
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPhotoItems.length === 0) {
      setCreateError("請至少上傳一張照片");
      return;
    }
    setCreating(true);
    setCreateError(null);

    const { html: descriptionHtml, images: descriptionImages } = descriptionEditorRef.current!.extractForSubmit();

    const formData = new FormData();
    formData.set("categoryId", String(categoryId));
    formData.set("title", newTitle);
    formData.set("description", descriptionHtml);
    if (newLoftId) formData.set("loftId", newLoftId);
    for (const item of newPhotoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }
    for (const image of descriptionImages) {
      formData.append("descriptionImages", image);
    }

    const response = await fetch("/api/admin/pigeon-gallery/items", { method: "POST", body: formData });
    const data = await response.json();

    setCreating(false);
    if (!data.ok) {
      setCreateError(data.error ?? "新增失敗");
      return;
    }
    setNewTitle("");
    setNewLoftId("");
    setNewDescription("");
    setNewPhotoItems([]);
    await load();
  }

  async function handleDelete(item: ItemRow) {
    if (!confirm(`確定要刪除「${item.title}」嗎？此動作無法撤銷。`)) {
      return;
    }
    const response = await fetch(`/api/admin/pigeon-gallery/items/${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "刪除失敗");
      return;
    }
    await load();
  }

  async function handleMove(item: ItemRow, direction: "up" | "down") {
    if (!items) return;
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    const orderedIds = sorted.map((row) => row.id);
    [orderedIds[index], orderedIds[swapWith]] = [orderedIds[swapWith], orderedIds[index]];

    const response = await fetch("/api/admin/pigeon-gallery/items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, orderedIds }),
    });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "排序失敗");
      return;
    }
    await load();
  }

  const sortedItems = items ? [...items].sort((a, b) => a.sortOrder - b.sortOrder) : null;
  const loftTitleById = new Map(lofts.map((loft) => [loft.id, loft.title]));

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-light">
            標題
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={255}
              required
              placeholder="例如：2025 年度冠軍鴿"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-light">
            合作鴿舍（選填）
            <select value={newLoftId} onChange={(e) => setNewLoftId(e.target.value)} className={inputClass}>
              <option value="">無</option>
              {lofts.map((loft) => (
                <option key={loft.id} value={loft.id}>
                  {loft.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <PhotoGalleryEditor items={newPhotoItems} onChange={setNewPhotoItems} />

        <div className="flex flex-col gap-1 text-xs text-ink-light">
          描述（選填）
          <DescriptionEditor ref={descriptionEditorRef} value={newDescription} onChange={setNewDescription} />
        </div>

        <div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "新增中..." : "新增項目"}
          </button>
          {createError && <p className="mt-2 text-sm text-ended">{createError}</p>}
        </div>
      </form>

      {error && <p className="text-sm text-ended">{error}</p>}

      {!sortedItems ? (
        <p className="text-ink-light">載入中...</p>
      ) : sortedItems.length === 0 ? (
        <p className="text-ink-light">目前尚無展示項目，請先新增一個。</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>圖片</th>
                <th className={th}>標題</th>
                <th className={th}>合作鴿舍</th>
                <th className={th}>排序</th>
                <th className={th}>狀態</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr key={item.id} className="transition hover:bg-surface-muted/80">
                  <td className={td}>
                    <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover" />
                  </td>
                  <td className={td}>
                    <span className="font-medium text-ink">{item.title}</span>
                  </td>
                  <td className={td}>{(item.loftId ? loftTitleById.get(item.loftId) : null) ?? "—"}</td>
                  <td className={td}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(item, "up")}
                        disabled={index === 0}
                        className="rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(item, "down")}
                        disabled={index === sortedItems.length - 1}
                        className="rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className={td}>
                    {item.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">上架中</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-light">已下架</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <EditGalleryItemModal itemId={item.id} sortOrder={item.sortOrder} onSaved={load} />
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-md border border-ended px-3 py-1.5 text-xs font-medium text-ended hover:bg-ended-bg"
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
