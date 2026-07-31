// Pure constants shared between the server-side upload handler
// (lib/uploads.ts, which imports Node's fs/crypto and can't be imported
// into client components) and the client-side photo picker
// (app/z04urru6/listings/new/NewListingForm.tsx), which needs the same
// numbers to validate before ever hitting the server.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB per photo
export const MAX_PHOTO_COUNT = 8;
