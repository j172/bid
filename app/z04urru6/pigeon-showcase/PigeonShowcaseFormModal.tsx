"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NAME_MAX, type PigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import PigeonDescriptionEditor from "./PigeonDescriptionEditor";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export interface PigeonLoftOption {
  id: number;
  title: string;
}

type EditItem = {
  id: number;
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number;
  description: string;
};

type Props = { mode: "create"; lofts: PigeonLoftOption[] } | { mode: "edit"; lofts: PigeonLoftOption[]; item: EditItem };

const CATEGORY_LABEL: Record<PigeonShowcaseCategory, string> = { award: "入賞鴿", imported: "進口鴿" };

// Same create/edit modal split pattern as
// app/z04urru6/homepage/partner-lofts/PartnerLoftFormModal.tsx — one
// component doubles as both forms, differing only in submit verb/URL and
// initial values. Submits JSON (not FormData) since pigeon_showcase has no
// file upload, unlike homepage_sections's image field.
export default function PigeonShowcaseFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PigeonShowcaseCategory>(isEdit ? props.item.category : "award");
  const [name, setName] = useState(isEdit ? props.item.name : "");
  const [loftId, setLoftId] = useState(isEdit ? String(props.item.loftId) : (props.lofts[0] ? String(props.lofts[0].id) : ""));
  const [description, setDescription] = useState(isEdit ? props.item.description : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setCategory(isEdit ? props.item.category : "award");
    setName(isEdit ? props.item.name : "");
    setLoftId(isEdit ? String(props.item.loftId) : (props.lofts[0] ? String(props.lofts[0].id) : ""));
    setDescription(isEdit ? props.item.description : "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!loftId) {
      setError("請選擇鴿舍");
      return;
    }

    setSubmitting(true);
    const payload = { category, name, loftId: Number(loftId), description };

    const response = await fetch(isEdit ? `/api/admin/pigeon-showcase/${props.item.id}` : "/api/admin/pigeon-showcase", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ ok: false, error: "儲存失敗" }));

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }
    setOpen(false);
    if (!isEdit) resetForm();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isEdit
            ? "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            : "rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active"
        }
      >
        {isEdit ? "編輯" : "＋ 新增鴿況"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{isEdit ? "編輯鴿況" : "新增鴿況"}</h2>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                鴿種
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PigeonShowcaseCategory)}
                  className={inputClass}
                >
                  {(Object.keys(CATEGORY_LABEL) as PigeonShowcaseCategory[]).map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                名稱
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} required className={inputClass} />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                鴿舍
                <select value={loftId} onChange={(e) => setLoftId(e.target.value)} required className={inputClass}>
                  <option value="" disabled>
                    請選擇鴿舍
                  </option>
                  {props.lofts.map((loft) => (
                    <option key={loft.id} value={loft.id}>
                      {loft.title}
                    </option>
                  ))}
                </select>
                {props.lofts.length === 0 && (
                  <span className="text-xs text-ended">目前沒有任何合作鴿舍，請先於「合作鴿舍管理」新增。</span>
                )}
              </label>

              <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                簡介
                <PigeonDescriptionEditor value={description} onChange={setDescription} />
              </div>

              {error && <p className="text-sm text-ended">{error}</p>}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || props.lofts.length === 0}
                  className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
