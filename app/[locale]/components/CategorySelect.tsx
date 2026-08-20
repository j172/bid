"use client";

import { useRouter } from "@/i18n/navigation";

export interface CategorySelectOption {
  /** Matches the server-computed `value` prop so the <select> reflects the current filter. */
  value: string;
  label: string;
  /** Destination built server-side via listingsHref/withFilters — kept as a plain string. */
  href: string;
}

interface CategorySelectProps {
  options: readonly CategorySelectOption[];
  value: string;
  ariaLabel: string;
  className?: string;
}

// Listings page's 分類 filter (issue #169) — a small client island so the
// surrounding /listings page can stay a server component. Selecting an
// option navigates immediately (no "套用" button), mirroring how the
// type/category Links already navigate on click.
export default function CategorySelect({ options, value, ariaLabel, className }: CategorySelectProps) {
  const router = useRouter();

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value);
        if (selected) router.push(selected.href);
      }}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
