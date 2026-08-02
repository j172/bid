"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { GalleryType } from "@/lib/pigeonGallery";

interface CategoryRow {
  id: number;
  galleryType: GalleryType;
  name: string;
  coverImageFileName: string;
  coverImageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm align-top";
const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export default function CategoryManager({ galleryType }: { galleryType: GalleryType }) {
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/admin/pigeon-gallery/categories?galleryType=${galleryType}`);
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "讀取失敗");
      return;
    }
    setCategories(data.categories);
  }, [galleryType]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newImage) {
      setCreateError("請選擇封面圖片");
      return;
    }
    setCreating(true);
    setCreateError(null);

    const formData = new FormData();
    formData.set("galleryType", galleryType);
    formData.set("name", newName);
    formData.set("image", newImage);

    const response = await fetch("/api/admin/pigeon-gallery/categories", { method: "POST", body: formData });
    const data = await response.json();

    setCreating(false);
    if (!data.ok) {
      setCreateError(data.error ?? "新增失敗");
      return;
    }
    setNewName("");
    setNewImage(null);
    await load();
  }

  function startEdit(category: CategoryRow) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditImage(null);
    setEditIsActive(category.isActive);
    setEditError(null);
  }

  async function handleUpdate(category: CategoryRow) {
    setEditSubmitting(true);
    setEditError(null);

    const formData = new FormData();
    formData.set("name", editName);
    formData.set("sortOrder", String(category.sortOrder));
    formData.set("isActive", editIsActive ? "true" : "false");
    if (editImage) formData.set("image", editImage);

    const response = await fetch(`/api/admin/pigeon-gallery/categories/${category.id}`, { method: "PATCH", body: formData });
    const data = await response.json();

    setEditSubmitting(false);
    if (!data.ok) {
      setEditError(data.error ?? "更新失敗");
      return;
    }
    setEditingId(null);
    await load();
  }

  async function handleDelete(category: CategoryRow) {
    if (!confirm(`確定要刪除「${category.name}」嗎？此分類底下的展示項目也會一併刪除，此動作無法撤銷。`)) {
      return;
    }
    const response = await fetch(`/api/admin/pigeon-gallery/categories/${category.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "刪除失敗");
      return;
    }
    await load();
  }

  async function handleMove(category: CategoryRow, direction: "up" | "down") {
    if (!categories) return;
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((item) => item.id === category.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    const orderedIds = sorted.map((item) => item.id);
    [orderedIds[index], orderedIds[swapWith]] = [orderedIds[swapWith], orderedIds[index]];

    const response = await fetch("/api/admin/pigeon-gallery/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryType, orderedIds }),
    });
    const data = await response.json();
    if (!data.ok) {
      setError(data.error ?? "排序失敗");
      return;
    }
    await load();
  }

  const sortedCategories = categories ? [...categories].sort((a, b) => a.sortOrder - b.sortOrder) : null;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          分類名稱
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={100}
            required
            placeholder="例如：石君鴿舍"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          封面圖片
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "新增中..." : "新增分類"}
        </button>
        {createError && <p className="w-full text-sm text-ended">{createError}</p>}
      </form>

      {error && <p className="text-sm text-ended">{error}</p>}

      {!sortedCategories ? (
        <p className="text-ink-light">載入中...</p>
      ) : sortedCategories.length === 0 ? (
        <p className="text-ink-light">目前尚無分類，請先新增一個。</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>封面</th>
                <th className={th}>名稱</th>
                <th className={th}>排序</th>
                <th className={th}>狀態</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((category, index) => (
                <tr key={category.id} className="transition hover:bg-surface-muted/80">
                  <td className={td}>
                    <img
                      src={category.coverImageUrl}
                      alt={category.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </td>
                  <td className={td}>
                    {editingId === category.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={100}
                        className={inputClass}
                      />
                    ) : (
                      <span className="font-medium text-ink">{category.name}</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(category, "up")}
                        disabled={index === 0}
                        className="rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(category, "down")}
                        disabled={index === sortedCategories.length - 1}
                        className="rounded-md border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className={td}>
                    {editingId === category.id ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
                        上架顯示
                      </label>
                    ) : category.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">上架中</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-light">已下架</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {editingId === category.id ? (
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
                            onClick={() => handleUpdate(category)}
                            disabled={editSubmitting}
                            className="rounded-md bg-header px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editSubmitting ? "儲存中..." : "儲存"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/z04urru6/homepage/pigeon-gallery/items?categoryId=${category.id}`}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
                        >
                          管理項目
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
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
