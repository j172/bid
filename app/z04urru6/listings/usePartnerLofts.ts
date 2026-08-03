"use client";

import { useEffect, useState } from "react";

export interface PartnerLoftOption {
  id: number;
  title: string;
}

// Shared by NewListingForm and EditListingModal (issue #45) to populate the
// optional 合作鴿舍 dropdown — reuses the existing admin homepage-sections
// list endpoint (activeOnly: only lofts still visible on the homepage are
// offered) rather than a new endpoint, since it already returns exactly
// { id, title } (plus fields these forms don't need).
export function usePartnerLofts(): PartnerLoftOption[] {
  const [lofts, setLofts] = useState<PartnerLoftOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/homepage-sections?sectionType=partner_loft&activeOnly=1")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.ok) {
          setLofts(data.sections.map((section: { id: number; title: string }) => ({ id: section.id, title: section.title })));
        }
      })
      .catch(() => {
        // Non-fatal — the dropdown just stays empty (loft assignment is optional).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return lofts;
}
