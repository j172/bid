"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const NAME_MAX = 200;

export type EditPigeonShop = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
};

type Props = { mode: "create" } | { mode: "edit"; shop: EditPigeonShop };

// 鴿店地圖目錄後台 CRUD (issue #243) — for manual maintenance after
// scripts/import-pigeon-shops.mjs's one-time import. Modeled directly on
// HomepageVideoFormModal.tsx; unlike that form, lat/lng here are plain
// number inputs (no live geocoding call from the admin UI — that only
// happens in the import script) since this is meant for occasional manual
// fixes (typo corrections, a shop that closed, one new entry), not bulk entry.
export default function PigeonShopFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const nameInputId = useId();
  const phoneInputId = useId();
  const addressInputId = useId();
  const latInputId = useId();
  const lngInputId = useId();
  const sourceUrlInputId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(isEdit ? props.shop.name : "");
  const [phone, setPhone] = useState(isEdit ? (props.shop.phone ?? "") : "");
  const [address, setAddress] = useState(isEdit ? (props.shop.address ?? "") : "");
  const [lat, setLat] = useState(isEdit && props.shop.lat !== null ? String(props.shop.lat) : "");
  const [lng, setLng] = useState(isEdit && props.shop.lng !== null ? String(props.shop.lng) : "");
  const [sourceUrl, setSourceUrl] = useState(isEdit ? props.shop.sourceUrl : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName(isEdit ? props.shop.name : "");
    setPhone(isEdit ? (props.shop.phone ?? "") : "");
    setAddress(isEdit ? (props.shop.address ?? "") : "");
    setLat(isEdit && props.shop.lat !== null ? String(props.shop.lat) : "");
    setLng(isEdit && props.shop.lng !== null ? String(props.shop.lng) : "");
    setSourceUrl(isEdit ? props.shop.sourceUrl : "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("請輸入店名");
      return;
    }

    if ((lat.trim() === "") !== (lng.trim() === "")) {
      setError("經度與緯度請一起填寫，或一起留空");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmedName,
      phone: phone.trim() || null,
      address: address.trim() || null,
      lat: lat.trim() === "" ? null : Number(lat.trim()),
      lng: lng.trim() === "" ? null : Number(lng.trim()),
      sourceUrl: sourceUrl.trim(),
    };

    try {
      const endpoint = isEdit ? `/api/admin/pigeon-shops/${props.shop.id}` : "/api/admin/pigeon-shops";
      const response = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setSubmitting(false);

      if (!data.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }

      setOpen(false);
      if (!isEdit) resetForm();
      router.refresh();
    } catch {
      setSubmitting(false);
      setError("連線失敗，請稍後再試");
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          編輯
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-interactive-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          ＋ 新增鴿店
        </button>
      )}

      {open && (
        <AdminModal
          title={isEdit ? "編輯鴿店資料" : "新增鴿店"}
          onOverlayClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor={nameInputId} className="block text-xs font-semibold text-ink-light">
                店名 <span className="text-ended">*</span>
              </label>
              <input
                id={nameInputId}
                type="text"
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>

            <div>
              <label htmlFor={phoneInputId} className="block text-xs font-semibold text-ink-light">
                電話
              </label>
              <input
                id={phoneInputId}
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="留空表示未知"
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label htmlFor={addressInputId} className="block text-xs font-semibold text-ink-light">
                地址
              </label>
              <input
                id={addressInputId}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="留空表示未知"
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={latInputId} className="block text-xs font-semibold text-ink-light">
                  緯度 (lat)
                </label>
                <input
                  id={latInputId}
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="例如 22.6714710"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label htmlFor={lngInputId} className="block text-xs font-semibold text-ink-light">
                  經度 (lng)
                </label>
                <input
                  id={lngInputId}
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="例如 120.4936590"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-ink-light">
              經緯度留空則此鴿店只會顯示在下方列表，不會出現在地圖上。可至
              {" "}
              <a
                href="https://www.openstreetmap.org/search"
                target="_blank"
                rel="noopener noreferrer"
                className="text-interactive-primary hover:underline"
              >
                OpenStreetMap
              </a>{" "}
              搜尋地址取得座標。
            </p>

            <div>
              <label htmlFor={sourceUrlInputId} className="block text-xs font-semibold text-ink-light">
                原文網址
              </label>
              <input
                id={sourceUrlInputId}
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="手動新增可留空"
                className={`mt-1 ${inputClass}`}
              />
            </div>

            {error && <p className="text-sm text-ended">{error}</p>}

            <ModalFormActions
              onCancel={() => {
                resetForm();
                setOpen(false);
              }}
              submitting={submitting}
              submitLabel={isEdit ? "儲存變更" : "新增鴿店"}
              pendingLabel="儲存中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
