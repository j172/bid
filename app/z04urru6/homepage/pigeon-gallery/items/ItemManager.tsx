"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryPriceType } from "@/lib/pigeonGallery";

interface ItemRow {
  id: number;
  categoryId: number;
  title: string;
  imageFileName: string;
  imageUrl: string;
  priceType: GalleryPriceType;
  referencePrice: number;
  sortOrder: number;
  isActive: boolean;
}

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm align-top";
const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

const PRICE_TYPE_LABEL: Record<GalleryPriceType, string> = { auction: "競標種鴿", fixed_price: "定價種鴿" };

export default function ItemManager({ categoryId }: { categoryId: number }) {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newPriceType, setNewPriceType] = useState<GalleryPriceType>("auction");
  const [newPrice, setNewPrice] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriceType, setEditPriceType] = useState<GalleryPriceType>("auction");
  const [editPrice, setEditPrice] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
    if (!newImage) {
      setCreateError("請選擇圖片");
      return;
    }
    setCreating(true);
    setCreateError(null);

    const formData = new FormData();
    formData.set("categoryId", String(categoryId));
    formData.set("title", newTitle);
    formData.set("priceType", newPriceType);
    formData.set("referencePrice", newPrice);
    formData.set("image", newImage);

    const response = await fetch("/api/admin/pigeon-gallery/items", { method: "POST", body: formData });
    const data = await response.json();

    setCreating(false);
    if (!data.ok) {
      setCreateError(data.error ?? "新增失敗");
      return;
    }
    setNewTitle("");
    setNewPriceType("auction");
    setNewPrice("");
    setNewImage(null);
    await load();
  }

  function startEdit(item: ItemRow) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditPriceType(item.priceType);
    setEditPrice(String(item.referencePrice));
    setEditImage(null);
    setEditIsActive(item.isActive);
    setEditError(null);
  }

  async function handleUpdate(item: ItemRow) {
    setEditSubmitting(true);
    setEditError(null);

    const formData = new FormData();
    formData.set("title", editTitle);
    formData.set("priceType", editPriceType);
    formData.set("referencePrice", editPrice);
    formData.set("sortOrder", String(item.sortOrder));
    formData.set("isActive", editIsActive ? "true" : "false");
    if (editImage) formData.set("image", editImage);

    const response = await fetch(`/api/admin/pigeon-gallery/items/${item.id}`, { method: "PATCH", body: formData });
    const data = await response.json();

    setEditSubmitting(false);
    if (!data.ok) {
      setEditError(data.error ?? "更新失敗");
      return;
    }
    setEditingId(null);
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

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
      >
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
          類型
          <select
            value={newPriceType}
            onChange={(e) => setNewPriceType(e.target.value as GalleryPriceType)}
            className={inputClass}
          >
            <option value="auction">競標種鴿</option>
            <option value="fixed_price">定價種鴿</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          參考價格
          <input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            type="number"
            min={1}
            step={1}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          圖片
          <input type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "新增中..." : "新增項目"}
        </button>
        {createError && <p className="w-full text-sm text-ended">{createError}</p>}
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
                <th className={th}>類型</th>
                <th className={th}>參考價格</th>
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
                    {editingId === item.id ? (
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={255} className={inputClass} />
                    ) : (
                      <span className="font-medium text-ink">{item.title}</span>
                    )}
                  </td>
                  <td className={td}>
                    {editingId === item.id ? (
                      <select
                        value={editPriceType}
                        onChange={(e) => setEditPriceType(e.target.value as GalleryPriceType)}
                        className={inputClass}
                      >
                        <option value="auction">競標種鴿</option>
                        <option value="fixed_price">定價種鴿</option>
                      </select>
                    ) : (
                      PRICE_TYPE_LABEL[item.priceType]
                    )}
                  </td>
                  <td className={td}>
                    {editingId === item.id ? (
                      <input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        type="number"
                        min={1}
                        step={1}
                        className={inputClass}
                      />
                    ) : (
                      item.referencePrice.toLocaleString()
                    )}
                  </td>
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
                    {editingId === item.id ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                        上架顯示
                      </label>
                    ) : item.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">上架中</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-light">已下架</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {editingId === item.id ? (
                      <div className="flex flex-col items-end gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                          className="text-xs"
                        />
                        {editError && <span className="text-xs text-ended">{editError}</span>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={editSubmitting}
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdate(item)}
                            disabled={editSubmitting}
                            className="rounded-md bg-header px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editSubmitting ? "儲存中..." : "儲存"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="rounded-md border border-ended px-3 py-1.5 text-xs font-medium text-ended hover:bg-ended-bg"
                        >
                          刪除
                        </button>
                      </div>
                    )}
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
