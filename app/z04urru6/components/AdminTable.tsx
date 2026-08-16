import type { ReactNode } from "react";
import { tableRowClass, tableWrapperClass, td, th } from "./tableStyles";

/**
 * 後台清單頁共用的表格外殼：卡片包裝 + `<table>` + 依 headers 產生的
 * `<thead>`。原本 8 個清單頁（listings、listings/closed、orders、news、
 * pigeon-showcase、users、homepage/partner-lofts、users/[id]）逐字複製同一份
 * `<div className={tableWrapperClass}><table className="w-full border-collapse">
 * <thead>…</thead>` 殼層與 `<th className={th}>` 迴圈（issue #139 M23）。
 *
 * tbody 內容仍由呼叫端負責——每頁欄位、互動元件差異很大，硬抽成 data-driven
 * cell renderer 只會讓每頁的特例邏輯更難讀。改用 AdminTableRow /
 * AdminTableCell 取代原本重複的 `<tr className={tableRowClass}>` /
 * `<td className={td}>` 寫法即可。
 *
 * wrapperClassName 預設是清單頁常見的卡片包裝，users/[id]/page.tsx 的出價
 * 紀錄表格用的是較輕量的 `mt-4 overflow-x-auto`，可自行覆寫。
 */
export function AdminTable({
  headers,
  children,
  wrapperClassName = tableWrapperClass,
}: {
  headers: ReactNode[];
  children: ReactNode;
  wrapperClassName?: string;
}) {
  return (
    <div className={wrapperClassName}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className={th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminTableRow({ children, className = tableRowClass }: { children: ReactNode; className?: string }) {
  return <tr className={className}>{children}</tr>;
}

export function AdminTableCell({
  children,
  className,
  title,
}: {
  children: ReactNode;
  /** 疊加在共用 td class 之後的額外樣式，例如 "font-semibold"、"text-right"。 */
  className?: string;
  title?: string;
}) {
  return (
    <td className={className ? `${td} ${className}` : td} title={title}>
      {children}
    </td>
  );
}
