"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const NAME_MAX = 200;

export type EditPigeonGroup = {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  secretaryName: string | null;
  secretaryPhone: string | null;
  websiteUrl: string | null;
  pigeonTrackingUrl: string | null;
  sourceUrl: string;
};

type Props = { mode: "create" } | { mode: "edit"; group: EditPigeonGroup };

// 鴿會查詢後台 CRUD (issue #260) — for manual maintenance after
// scripts/import-cb-pigeon-groups.mjs's one-time import. Modeled directly on
// app/z04urru6/pigeon-shops/PigeonShopFormModal.tsx; lat/lng here are plain
// number inputs (no live geocoding call from the admin UI — that only
// happens in the import script) since this is meant for occasional manual
// fixes, not bulk entry.
export default function PigeonGroupFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const nameInputId = useId();
  const addressInputId = useId();
  const latInputId = useId();
  const lngInputId = useId();
  const chairmanNameInputId = useId();
  const chairmanPhoneInputId = useId();
  const secretaryNameInputId = useId();
  const secretaryPhoneInputId = useId();
  const websiteUrlInputId = useId();
  const pigeonTrackingUrlInputId = useId();
  const sourceUrlInputId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(isEdit ? props.group.name : "");
  const [address, setAddress] = useState(isEdit ? (props.group.address ?? "") : "");
  const [lat, setLat] = useState(isEdit && props.group.lat !== null ? String(props.group.lat) : "");
  const [lng, setLng] = useState(isEdit && props.group.lng !== null ? String(props.group.lng) : "");
  const [chairmanName, setChairmanName] = useState(isEdit ? (props.group.chairmanName ?? "") : "");
  const [chairmanPhone, setChairmanPhone] = useState(isEdit ? (props.group.chairmanPhone ?? "") : "");
  const [secretaryName, setSecretaryName] = useState(isEdit ? (props.group.secretaryName ?? "") : "");
  const [secretaryPhone, setSecretaryPhone] = useState(isEdit ? (props.group.secretaryPhone ?? "") : "");
  const [websiteUrl, setWebsiteUrl] = useState(isEdit ? (props.group.websiteUrl ?? "") : "");
  const [pigeonTrackingUrl, setPigeonTrackingUrl] = useState(isEdit ? (props.group.pigeonTrackingUrl ?? "") : "");
  const [sourceUrl, setSourceUrl] = useState(isEdit ? props.group.sourceUrl : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName(isEdit ? props.group.name : "");
    setAddress(isEdit ? (props.group.address ?? "") : "");
    setLat(isEdit && props.group.lat !== null ? String(props.group.lat) : "");
    setLng(isEdit && props.group.lng !== null ? String(props.group.lng) : "");
    setChairmanName(isEdit ? (props.group.chairmanName ?? "") : "");
    setChairmanPhone(isEdit ? (props.group.chairmanPhone ?? "") : "");
    setSecretaryName(isEdit ? (props.group.secretaryName ?? "") : "");
    setSecretaryPhone(isEdit ? (props.group.secretaryPhone ?? "") : "");
    setWebsiteUrl(isEdit ? (props.group.websiteUrl ?? "") : "");
    setPigeonTrackingUrl(isEdit ? (props.group.pigeonTrackingUrl ?? "") : "");
    setSourceUrl(isEdit ? props.group.sourceUrl : "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("請輸入鴿會名稱");
      return;
    }

    if ((lat.trim() === "") !== (lng.trim() === "")) {
      setError("經度與緯度請一起填寫，或一起留空");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmedName,
      address: address.trim() || null,
      lat: lat.trim() === "" ? null : Number(lat.trim()),
      lng: lng.trim() === "" ? null : Number(lng.trim()),
      chairmanName: chairmanName.trim() || null,
      chairmanPhone: chairmanPhone.trim() || null,
      secretaryName: secretaryName.trim() || null,
      secretaryPhone: secretaryPhone.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      pigeonTrackingUrl: pigeonTrackingUrl.trim() || null,
      sourceUrl: sourceUrl.trim(),
    };

    try {
      const endpoint = isEdit ? `/api/admin/pigeon-groups/${props.group.id}` : "/api/admin/pigeon-groups";
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
          ＋ 新增鴿會
        </button>
      )}

      {open && (
        <AdminModal
          title={isEdit ? "編輯鴿會資料" : "新增鴿會"}
          size="lg"
          onOverlayClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor={nameInputId} className="block text-xs font-semibold text-ink-light">
                鴿會名稱 <span className="text-ended">*</span>
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
                  placeholder="例如 24.7945127"
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
                  placeholder="例如 121.0256927"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-ink-light">
              經緯度留空則此鴿會只會顯示在下方列表，不會出現在地圖上。可至
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={chairmanNameInputId} className="block text-xs font-semibold text-ink-light">
                  會長姓名
                </label>
                <input
                  id={chairmanNameInputId}
                  type="text"
                  value={chairmanName}
                  onChange={(e) => setChairmanName(e.target.value)}
                  placeholder="留空表示未知"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label htmlFor={chairmanPhoneInputId} className="block text-xs font-semibold text-ink-light">
                  會長電話
                </label>
                <input
                  id={chairmanPhoneInputId}
                  type="text"
                  value={chairmanPhone}
                  onChange={(e) => setChairmanPhone(e.target.value)}
                  placeholder="留空表示未知"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={secretaryNameInputId} className="block text-xs font-semibold text-ink-light">
                  秘書姓名
                </label>
                <input
                  id={secretaryNameInputId}
                  type="text"
                  value={secretaryName}
                  onChange={(e) => setSecretaryName(e.target.value)}
                  placeholder="留空表示未知"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label htmlFor={secretaryPhoneInputId} className="block text-xs font-semibold text-ink-light">
                  秘書電話
                </label>
                <input
                  id={secretaryPhoneInputId}
                  type="text"
                  value={secretaryPhone}
                  onChange={(e) => setSecretaryPhone(e.target.value)}
                  placeholder="留空表示未知"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor={websiteUrlInputId} className="block text-xs font-semibold text-ink-light">
                官網網址
              </label>
              <input
                id={websiteUrlInputId}
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="留空表示無官網"
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div>
              <label htmlFor={pigeonTrackingUrlInputId} className="block text-xs font-semibold text-ink-light">
                即時返鴿查詢網址
              </label>
              <input
                id={pigeonTrackingUrlInputId}
                type="text"
                value={pigeonTrackingUrl}
                onChange={(e) => setPigeonTrackingUrl(e.target.value)}
                placeholder="留空表示無此服務"
                className={`mt-1 ${inputClass}`}
              />
            </div>

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
              submitLabel={isEdit ? "儲存變更" : "新增鴿會"}
              pendingLabel="儲存中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
