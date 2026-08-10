// Issue #139 M3 — the real logic hole in the API review, not just a
// duplication cleanup: app/api/admin/listings/[id]/edit used to accept the
// client's photo-order array after checking only `Array.isArray`, then index
// straight into it. An entry with a bogus `type`, or a "new" entry whose
// `index` pointed past the files actually uploaded, resolved to `undefined`
// and was written into listing_photos as part of the listing's photo order.
// Pure/no-I/O, so tested directly like lib/listingValidation.test.ts.

import { describe, expect, it } from "vitest";
import { parsePhotoOrder, resolvePhotoOrder, type PhotoOrderEntry } from "./listingPhotoOrder";

describe("parsePhotoOrder", () => {
  it("accepts a well-formed mix of existing and new entries", () => {
    const raw = JSON.stringify([
      { type: "existing", fileName: "a.webp" },
      { type: "new", index: 0 },
      { type: "existing", fileName: "b.webp" },
    ]);

    expect(parsePhotoOrder(raw)).toEqual([
      { type: "existing", fileName: "a.webp" },
      { type: "new", index: 0 },
      { type: "existing", fileName: "b.webp" },
    ]);
  });

  it("accepts an empty array (the caller enforces the 至少一張 rule separately)", () => {
    expect(parsePhotoOrder("[]")).toEqual([]);
  });

  it("rejects unparseable JSON", () => {
    expect(parsePhotoOrder("{not json")).toBeNull();
  });

  it("rejects a payload that isn't an array", () => {
    expect(parsePhotoOrder('{"type":"existing","fileName":"a.webp"}')).toBeNull();
    expect(parsePhotoOrder('"a.webp"')).toBeNull();
    expect(parsePhotoOrder("null")).toBeNull();
  });

  it("rejects an entry whose type is neither 'existing' nor 'new'", () => {
    expect(parsePhotoOrder('[{"type":"deleted","fileName":"a.webp"}]')).toBeNull();
    expect(parsePhotoOrder('[{"fileName":"a.webp"}]')).toBeNull();
  });

  it("rejects entries that aren't objects at all", () => {
    expect(parsePhotoOrder('["a.webp"]')).toBeNull();
    expect(parsePhotoOrder("[null]")).toBeNull();
    expect(parsePhotoOrder("[1]")).toBeNull();
  });

  it("rejects an 'existing' entry without a usable fileName", () => {
    expect(parsePhotoOrder('[{"type":"existing"}]')).toBeNull();
    expect(parsePhotoOrder('[{"type":"existing","fileName":""}]')).toBeNull();
    expect(parsePhotoOrder('[{"type":"existing","fileName":123}]')).toBeNull();
  });

  it("rejects a 'new' entry whose index isn't a non-negative integer", () => {
    expect(parsePhotoOrder('[{"type":"new"}]')).toBeNull();
    expect(parsePhotoOrder('[{"type":"new","index":-1}]')).toBeNull();
    expect(parsePhotoOrder('[{"type":"new","index":1.5}]')).toBeNull();
    expect(parsePhotoOrder('[{"type":"new","index":"0"}]')).toBeNull();
  });
});

describe("resolvePhotoOrder", () => {
  const existingFileNames = ["a.webp", "b.webp"];
  const newFileNames = ["new-0.webp", "new-1.webp"];

  it("resolves each entry to its file name, preserving the requested order", () => {
    const order: PhotoOrderEntry[] = [
      { type: "new", index: 1 },
      { type: "existing", fileName: "b.webp" },
      { type: "new", index: 0 },
      { type: "existing", fileName: "a.webp" },
    ];

    expect(resolvePhotoOrder(order, existingFileNames, newFileNames)).toEqual([
      "new-1.webp",
      "b.webp",
      "new-0.webp",
      "a.webp",
    ]);
  });

  it("rejects a 'new' index past the end of what this request actually saved", () => {
    // The regression this whole module exists for: savedFileNames[2] is
    // undefined, and used to be written into listing_photos as-is.
    const order: PhotoOrderEntry[] = [{ type: "new", index: 2 }];

    expect(resolvePhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("rejects any 'new' entry when no files were uploaded at all", () => {
    expect(resolvePhotoOrder([{ type: "new", index: 0 }], existingFileNames, [])).toBeNull();
  });

  it("rejects an 'existing' file name this listing doesn't have", () => {
    const order: PhotoOrderEntry[] = [{ type: "existing", fileName: "someone-elses.webp" }];

    expect(resolvePhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("rejects the whole order when only one entry is out of range — never a partial write", () => {
    const order: PhotoOrderEntry[] = [
      { type: "existing", fileName: "a.webp" },
      { type: "new", index: 99 },
    ];

    expect(resolvePhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("allows dropping photos: an order that omits an existing file is fine", () => {
    const order: PhotoOrderEntry[] = [{ type: "existing", fileName: "a.webp" }];

    expect(resolvePhotoOrder(order, existingFileNames, newFileNames)).toEqual(["a.webp"]);
  });

  it("never yields undefined for any accepted order", () => {
    const order: PhotoOrderEntry[] = [
      { type: "new", index: 0 },
      { type: "existing", fileName: "a.webp" },
    ];

    const resolved = resolvePhotoOrder(order, existingFileNames, newFileNames);

    expect(resolved).not.toBeNull();
    expect(resolved?.every((fileName) => typeof fileName === "string")).toBe(true);
  });
});
