// Limits for images inserted inline into a listing's rich-text description
// (via DescriptionEditor) — deliberately separate from lib/photoLimits.ts's
// gallery limits, since the two serve different purposes (main product
// photos vs. supplementary images inside the description body).

export const DESCRIPTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB per image
export const DESCRIPTION_IMAGE_MAX_COUNT = 10;
