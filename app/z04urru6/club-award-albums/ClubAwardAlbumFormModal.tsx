"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALBUM_NAME_MAX } from "@/lib/pigeons/clubAwardPigeonsValidation";
import { MODAL_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";
import { useSuccessBanner } from "../components/SuccessBanner";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

type EditAlbumItem = {
  id: number;
  name: string;
  sortOrder: number;
};

type Props = { mode: "create" } | { mode: "edit"; item: EditAlbumItem };

export default function ClubAwardAlbumFormModal(props: Props) {
  const router = useRouter();
  const showBanner = useSuccessBanner();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(isEdit ? props.item.name : "");
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.item.sortOrder) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName(isEdit ? props.item.name : "");
    setSortOrder(isEdit ? String(props.item.sortOrder) : "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入相簿名稱");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        isEdit ? `/api/admin/club-award-albums/${props.item.id}` : "/api/admin/club-award-albums",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            ...(sortOrder.trim() ? { sortOrder: Number(sortOrder) } : {}),
          }),
        },
      );
      const data = await response.json().catch(() => ({ ok: false, error: "儲存失敗" }));

      setSubmitting(false);
      if (!data.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }

      setOpen(false);
      if (!isEdit) resetForm();
      router.refresh();
      showBanner(isEdit ? "updated" : "created");
    } catch {
      setSubmitting(false);
      setError("連線失敗，請稍後再試");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className={MODAL_TRIGGER_CLASS(isEdit)}
      >
        {isEdit ? "編輯" : "＋ 新增相簿"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯相簿名稱" : "新增相簿"} size="sm">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              相簿名稱
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={ALBUM_NAME_MAX}
                placeholder="例如：2026 春季南海賽鴿協會"
                required
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              排序值
              <input
                type="number"
                min={0}
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="留空時排在最後"
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-ended">{error}</p>}
            <ModalFormActions
              onCancel={() => {
                setOpen(false);
                resetForm();
              }}
              submitting={submitting}
              submitLabel="儲存"
              pendingLabel="儲存中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
