// Mirrors lib/listingPhotoOrder.test.ts's coverage for the shared
// parse/resolve shape, plus dedicated coverage for the isCover normalization
// this module adds on top (issue #277 — see productPhotoOrder.ts's header
// comment for why products need an explicit cover photo).

import { describe, expect, it } from "vitest";
import { parseProductPhotoOrder, resolveProductPhotoOrder, type ProductPhotoOrderEntry } from "./productPhotoOrder";

describe("parseProductPhotoOrder", () => {
  it("accepts a well-formed mix of existing and new entries with isCover", () => {
    const raw = JSON.stringify([
      { type: "existing", fileName: "a.webp", isCover: true },
      { type: "new", index: 0, isCover: false },
    ]);

    expect(parseProductPhotoOrder(raw)).toEqual([
      { type: "existing", fileName: "a.webp", isCover: true },
      { type: "new", index: 0, isCover: false },
    ]);
  });

  it("accepts an empty array (the caller enforces the 至少一張 rule separately)", () => {
    expect(parseProductPhotoOrder("[]")).toEqual([]);
  });

  it("rejects unparseable JSON", () => {
    expect(parseProductPhotoOrder("{not json")).toBeNull();
  });

  it("rejects a payload that isn't an array", () => {
    expect(parseProductPhotoOrder('{"type":"existing","fileName":"a.webp","isCover":true}')).toBeNull();
    expect(parseProductPhotoOrder("null")).toBeNull();
  });

  it("rejects an entry whose type is neither 'existing' nor 'new'", () => {
    expect(parseProductPhotoOrder('[{"type":"deleted","fileName":"a.webp","isCover":true}]')).toBeNull();
  });

  it("rejects an entry missing a boolean isCover", () => {
    expect(parseProductPhotoOrder('[{"type":"existing","fileName":"a.webp"}]')).toBeNull();
    expect(parseProductPhotoOrder('[{"type":"existing","fileName":"a.webp","isCover":"true"}]')).toBeNull();
  });

  it("rejects an 'existing' entry without a usable fileName", () => {
    expect(parseProductPhotoOrder('[{"type":"existing","isCover":true}]')).toBeNull();
    expect(parseProductPhotoOrder('[{"type":"existing","fileName":"","isCover":true}]')).toBeNull();
  });

  it("rejects a 'new' entry whose index isn't a non-negative integer", () => {
    expect(parseProductPhotoOrder('[{"type":"new","isCover":false}]')).toBeNull();
    expect(parseProductPhotoOrder('[{"type":"new","index":-1,"isCover":false}]')).toBeNull();
    expect(parseProductPhotoOrder('[{"type":"new","index":1.5,"isCover":false}]')).toBeNull();
  });
});

describe("resolveProductPhotoOrder", () => {
  const existingFileNames = ["a.webp", "b.webp"];
  const newFileNames = ["new-0.webp", "new-1.webp"];

  it("resolves each entry to {fileName, isCover}, preserving the requested order", () => {
    const order: ProductPhotoOrderEntry[] = [
      { type: "new", index: 1, isCover: false },
      { type: "existing", fileName: "b.webp", isCover: true },
      { type: "new", index: 0, isCover: false },
      { type: "existing", fileName: "a.webp", isCover: false },
    ];

    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toEqual([
      { fileName: "new-1.webp", isCover: false },
      { fileName: "b.webp", isCover: true },
      { fileName: "new-0.webp", isCover: false },
      { fileName: "a.webp", isCover: false },
    ]);
  });

  it("rejects a 'new' index past the end of what this request actually saved", () => {
    const order: ProductPhotoOrderEntry[] = [{ type: "new", index: 2, isCover: true }];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("rejects an 'existing' file name this product doesn't have", () => {
    const order: ProductPhotoOrderEntry[] = [{ type: "existing", fileName: "someone-elses.webp", isCover: true }];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("rejects the whole order when only one entry is out of range — never a partial write", () => {
    const order: ProductPhotoOrderEntry[] = [
      { type: "existing", fileName: "a.webp", isCover: true },
      { type: "new", index: 99, isCover: false },
    ];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toBeNull();
  });

  it("allows dropping photos: an order that omits an existing file is fine", () => {
    const order: ProductPhotoOrderEntry[] = [{ type: "existing", fileName: "a.webp", isCover: true }];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toEqual([
      { fileName: "a.webp", isCover: true },
    ]);
  });

  it("promotes the first photo to cover when the client marked none (defensive default)", () => {
    const order: ProductPhotoOrderEntry[] = [
      { type: "existing", fileName: "a.webp", isCover: false },
      { type: "existing", fileName: "b.webp", isCover: false },
    ];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toEqual([
      { fileName: "a.webp", isCover: true },
      { fileName: "b.webp", isCover: false },
    ]);
  });

  it("keeps only the first marked cover when the client (incorrectly) marked more than one", () => {
    const order: ProductPhotoOrderEntry[] = [
      { type: "existing", fileName: "a.webp", isCover: true },
      { type: "existing", fileName: "b.webp", isCover: true },
    ];
    expect(resolveProductPhotoOrder(order, existingFileNames, newFileNames)).toEqual([
      { fileName: "a.webp", isCover: true },
      { fileName: "b.webp", isCover: false },
    ]);
  });

  it("returns an empty array as-is when the order itself is empty (nothing to promote)", () => {
    expect(resolveProductPhotoOrder([], existingFileNames, newFileNames)).toEqual([]);
  });
});
