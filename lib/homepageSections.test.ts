// lib/homepageSections.ts is raw-SQL CRUD (no ORM, see its own header
// comment) rather than pure logic like lib/listingValidation.ts, so unlike
// that file's tests, these mock @/lib/db's getDb() and assert on the SQL/
// params each function sends plus how it maps mysql2's raw rows/results back
// into the module's public shapes — covering CRUD and reorder per issue #33's
// acceptance criteria.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHomepageSection,
  deleteHomepageSection,
  getHomepageSectionById,
  listHomepageSections,
  reorderHomepageSections,
  updateHomepageSection,
} from "./homepageSections";

// lib/homepageSections.ts is raw-SQL CRUD (no ORM, see its own header
// comment) rather than pure logic like lib/listingValidation.ts, so unlike
// that file's tests, these mock @/lib/db's getDb() and assert on the SQL/
// params each function sends plus how it maps mysql2's raw rows/results back
// into the module's public shapes — covering CRUD and reorder per issue #33's
// acceptance criteria. queryMock is created via vi.hoisted so it exists
// before vi.mock's factory below runs (vi.mock calls are hoisted above
// regular imports/const declarations by Vitest's transform).
const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("listHomepageSections", () => {
  it("filters by section_type and orders by sort_order, mapping snake_case rows to the public shape", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const updatedAt = new Date("2026-01-02T00:00:00Z");
    queryMock.mockResolvedValueOnce([
      [
        {
          id: 1,
          section_type: "partner_loft",
          title: "石君鴿舍",
          image_file_name: "a.webp",
          link_url: "/partners/1",
          sort_order: 0,
          is_active: 1,
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
    ]);

    const sections = await listHomepageSections("partner_loft");

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE section_type = ? ORDER BY sort_order ASC, id ASC"),
      ["partner_loft"],
    );
    expect(sections).toEqual([
      {
        id: 1,
        sectionType: "partner_loft",
        title: "石君鴿舍",
        imageFileName: "a.webp",
        linkUrl: "/partners/1",
        sortOrder: 0,
        isActive: true,
        createdAt,
        updatedAt,
      },
    ]);
  });

  it("adds an is_active = 1 condition when activeOnly is requested", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await listHomepageSections("partner_loft", { activeOnly: true });
    expect(queryMock.mock.calls[0][0]).toContain("is_active = 1");
  });

  it("omits the is_active condition by default (admin view sees inactive rows too)", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await listHomepageSections("partner_loft");
    expect(queryMock.mock.calls[0][0]).not.toContain("is_active");
  });
});

describe("getHomepageSectionById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getHomepageSectionById(999)).toBeNull();
  });

  it("maps is_active 0 to isActive: false", async () => {
    queryMock.mockResolvedValueOnce([
      [
        {
          id: 5,
          section_type: "partner_loft",
          title: "t",
          image_file_name: "f.webp",
          link_url: "/y",
          sort_order: 2,
          is_active: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    ]);
    const section = await getHomepageSectionById(5);
    expect(section?.isActive).toBe(false);
  });
});

describe("createHomepageSection", () => {
  it("uses an explicit sortOrder without a lookup query", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 42 }]);

    const id = await createHomepageSection({
      sectionType: "partner_loft",
      title: "t",
      imageFileName: "f.webp",
      linkUrl: "/y",
      sortOrder: 3,
    });

    expect(id).toBe(42);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(["partner_loft", "t", "f.webp", "/y", 3, 1]);
  });

  it("defaults sortOrder to MAX(sort_order) + 1 within the section_type when omitted", async () => {
    queryMock.mockResolvedValueOnce([[{ nextOrder: 7 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 8 }]);

    const id = await createHomepageSection({
      sectionType: "partner_loft",
      title: "t",
      imageFileName: "f.webp",
      linkUrl: "/y",
    });

    expect(id).toBe(8);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][1]).toEqual(["partner_loft"]);
    expect(queryMock.mock.calls[1][1]).toEqual(["partner_loft", "t", "f.webp", "/y", 7, 1]);
  });

  it("stores isActive: false as 0", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);
    await createHomepageSection({
      sectionType: "partner_loft",
      title: "t",
      imageFileName: "f.webp",
      linkUrl: "/y",
      sortOrder: 0,
      isActive: false,
    });
    expect(queryMock.mock.calls[0][1][5]).toBe(0);
  });
});

describe("updateHomepageSection", () => {
  it("returns ok:false when no row matched (deleted or bad id)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updateHomepageSection(1, {
      title: "t",
      imageFileName: "f",
      linkUrl: "/y",
      sortOrder: 0,
      isActive: true,
    });
    expect(result).toEqual({ ok: false, error: "找不到這個首頁區塊項目" });
  });

  it("returns ok:true when a row is updated", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updateHomepageSection(1, {
      title: "t",
      imageFileName: "f",
      linkUrl: "/y",
      sortOrder: 0,
      isActive: true,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("deleteHomepageSection", () => {
  it("returns ok:false when no row matched", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deleteHomepageSection(1)).toEqual({ ok: false, error: "找不到這個首頁區塊項目" });
  });

  it("returns ok:true when a row is deleted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deleteHomepageSection(1)).toEqual({ ok: true });
  });
});

describe("reorderHomepageSections", () => {
  it("returns ok:true immediately for an empty list without querying", async () => {
    const result = await reorderHomepageSections("partner_loft", []);
    expect(result).toEqual({ ok: true });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects the whole call when an id doesn't belong to the given section_type", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 1 }]]); // only 1 of 2 requested ids actually found
    const result = await reorderHomepageSections("partner_loft", [1, 2]);
    expect(result).toEqual({ ok: false, error: "排序資料不正確" });
    expect(queryMock).toHaveBeenCalledTimes(1); // no UPDATEs fired
  });

  it("re-sequences sort_order to match each id's index in the given order", async () => {
    queryMock.mockResolvedValueOnce([[{ id: 3 }, { id: 1 }]]); // membership check
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // update id 3
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // update id 1

    const result = await reorderHomepageSections("partner_loft", [3, 1]);

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[1][1]).toEqual([0, 3]);
    expect(queryMock.mock.calls[2][1]).toEqual([1, 1]);
  });
});
