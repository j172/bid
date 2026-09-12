"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export type EditPigeonStation = {
  id: number;
  name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
};

type Props = { mode: "create" } | { mode: "edit"; station: EditPigeonStation };

// Modeled on ../homepage-videos/HomepageVideoFormModal.tsx (issue #242): no
// sort_order/isActive here — every row always shows on the public map+list —
// but the same open/submit/error/reset shape.
export default function PigeonStationFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const nameInputId = useId();
  const phoneInputId = useId();
  const addressInputId = useId();
  const latInputId = useId();
  const lngInputId = useId();
  const sourceUrlInputId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(isEdit ? props.station.name : "");
  const [phone, setPhone] = useState(isEdit ? props.station.phone : "");
  const [address, setAddress] = useState(isEdit ? props.station.address : "");
  const [lat, setLat] = useState(isEdit && props.station.lat !== null ? String(props.station.lat) : "");
  const [lng, setLng] = useState(isEdit && props.station.lng !== null ? String(props.station.lng) : "");
  const [sourceUrl, setSourceUrl] = useState(isEdit ? props.station.sourceUrl : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName(isEdit ? props.station.name : "");
    setPhone(isEdit ? props.station.phone : "");
    setAddress(isEdit ? props.station.address : "");
    setLat(isEdit && props.station.lat !== null ? String(props.station.lat) : "");
    setLng(isEdit && props.station.lng !== null ? String(props.station.lng) : "");
    setSourceUrl(isEdit ? props.station.sourceUrl : "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("請輸入取鴿站名稱");
      return;
    }
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError("請輸入聯絡電話");
      return;
    }
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setError("請輸入地址");
      return;
    }
    const trimmedSourceUrl = sourceUrl.trim();
    if (!trimmedSourceUrl) {
      setError("請輸入資料來源網址");
      return;
    }

    const parsedLat = lat.trim() === "" ? null : Number(lat.trim());
    if (parsedLat !== null && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      setError("緯度必須介於 -90 到 90 之間");
      return;
    }
    const parsedLng = lng.trim() === "" ? null : Number(lng.trim());
    if (parsedLng !== null && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      setError("經度必須介於 -180 到 180 之間");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      address: trimmedAddress,
      sourceUrl: trimmedSourceUrl,
      lat: parsedLat,
      lng: parsedLng,
    };

    try {
      const endpoint = isEdit ? `/api/admin/pigeon-stations/${props.station.id}` : "/api/admin/pigeon-stations";
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
          ＋ 新增取鴿站
        </button>
      )}

      {open && (
        <AdminModal
          title={isEdit ? "編輯取鴿站" : "新增取鴿站"}
          size="lg"
          onOverlayClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor={nameInputId} className="block text-xs font-semibold text-ink-light">
                名稱 <span className="text-ended">*</span>
              </label>
              <input
                id={nameInputId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>

            <div>
              <label htmlFor={phoneInputId} className="block text-xs font-semibold text-ink-light">
                聯絡電話 <span className="text-ended">*</span>
              </label>
              <input
                id={phoneInputId}
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>

            <div>
              <label htmlFor={addressInputId} className="block text-xs font-semibold text-ink-light">
                地址 <span className="text-ended">*</span>
              </label>
              <input
                id={addressInputId}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={latInputId} className="block text-xs font-semibold text-ink-light">
                  緯度 (lat)
                </label>
                <input
                  id={latInputId}
                  type="text"
                  inputMode="decimal"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="留空表示尚未定位"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label htmlFor={lngInputId} className="block text-xs font-semibold text-ink-light">
                  經度 (lng)
                </label>
                <input
                  id={lngInputId}
                  type="text"
                  inputMode="decimal"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="留空表示尚未定位"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-light">
              可至{" "}
              <a
                href="https://nominatim.openstreetmap.org/ui/search.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-interactive-primary"
              >
                OpenStreetMap Nominatim
              </a>{" "}
              查詢地址對應座標。留空則此站不會出現在前台地圖上，僅列於清單。
            </p>

            <div>
              <label htmlFor={sourceUrlInputId} className="block text-xs font-semibold text-ink-light">
                資料來源網址 <span className="text-ended">*</span>
              </label>
              <input
                id={sourceUrlInputId}
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="例如：https://nicepigeon.com/news_detail.php?id=16"
                className={`mt-1 ${inputClass}`}
                required
              />
            </div>

            {error && <p className="text-sm text-ended">{error}</p>}

            <ModalFormActions
              onCancel={() => {
                resetForm();
                setOpen(false);
              }}
              submitting={submitting}
              submitLabel={isEdit ? "儲存變更" : "新增站點"}
              pendingLabel="儲存中..."
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
