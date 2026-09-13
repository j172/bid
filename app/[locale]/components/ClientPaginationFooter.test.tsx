// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ClientPaginationFooter from "./ClientPaginationFooter";

afterEach(() => {
  cleanup();
});

const labels = {
  pageSizeLabel: "每頁顯示：",
  prevPage: "上一頁",
  nextPage: "下一頁",
  pageInfo: "第 2 / 3 頁（共 65 筆）",
};

describe("ClientPaginationFooter", () => {
  it("calls onPageSizeChange with the clicked size", () => {
    const onPageSizeChange = vi.fn();
    render(
      <ClientPaginationFooter
        pageSizes={[30, 50, 100]}
        pageSize={30}
        page={2}
        totalPages={3}
        onPageSizeChange={onPageSizeChange}
        onPageChange={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByText("50"));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("shows prev/next only when applicable and calls onPageChange with the adjacent page", () => {
    const onPageChange = vi.fn();
    render(
      <ClientPaginationFooter
        pageSizes={[30, 50, 100]}
        pageSize={30}
        page={2}
        totalPages={3}
        onPageSizeChange={vi.fn()}
        onPageChange={onPageChange}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByText(labels.prevPage));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText(labels.nextPage));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("hides prev on the first page and next on the last page", () => {
    render(
      <ClientPaginationFooter
        pageSizes={[30, 50, 100]}
        pageSize={30}
        page={1}
        totalPages={3}
        onPageSizeChange={vi.fn()}
        onPageChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.queryByText(labels.prevPage)).toBeNull();
    expect(screen.getByText(labels.nextPage)).not.toBeNull();
  });

  it("hides the whole page-number row when there's only one page", () => {
    render(
      <ClientPaginationFooter
        pageSizes={[30, 50, 100]}
        pageSize={30}
        page={1}
        totalPages={1}
        onPageSizeChange={vi.fn()}
        onPageChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.queryByText(labels.pageInfo)).toBeNull();
  });
});
