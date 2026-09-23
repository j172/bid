// Covers the default sort behaviour for issue #333: opening the admin
// listings page with no `sort` query param should list newest-created first
// (created_desc), not soonest-ending first (ends_asc, the old default).
//
// The page never runs an actual React renderer here — calling the async
// server component directly only constructs element descriptor objects for
// its JSX, it does not invoke child components — so mocking
// getOpenListingsForAdmin (returning an empty page) is enough to observe
// what sort the page resolved and passed down.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOpenListingsForAdminMock } = vi.hoisted(() => ({
  getOpenListingsForAdminMock: vi.fn(),
}));

vi.mock("@/lib/listings", () => ({
  getOpenListingsForAdmin: getOpenListingsForAdminMock,
  OPEN_LISTINGS_PAGE_SIZE: 30,
}));

import AdminOpenListingsPage from "./page";

beforeEach(() => {
  getOpenListingsForAdminMock.mockReset();
  getOpenListingsForAdminMock.mockResolvedValue({ listings: [], total: 0 });
});

describe("AdminOpenListingsPage default sort", () => {
  it("defaults to created_desc when no sort query param is given", async () => {
    await AdminOpenListingsPage({ searchParams: Promise.resolve({}) });

    expect(getOpenListingsForAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "created_desc" }),
    );
  });

  it("still honours an explicit sort query param", async () => {
    await AdminOpenListingsPage({ searchParams: Promise.resolve({ sort: "ends_asc" }) });

    expect(getOpenListingsForAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "ends_asc" }),
    );
  });
});
