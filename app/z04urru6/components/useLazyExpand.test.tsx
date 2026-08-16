// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { useLazyExpand } from "./useLazyExpand";

// 「展開明細」fetch-once-then-cache 的共用邏輯，被出價者／得標者／買家／結算
// 明細等三個以上元件共用（issue #139 M29），原本沒有測試覆蓋。重點鎖住：
// 展開才 fetch、收合再展開不會重新 fetch、data 為 null 時例外地會重抓。

function stubJson(payload: unknown) {
  const fetchMock = vi.fn(async () => ({ json: async () => payload }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useLazyExpand", () => {
  it("初始是收合狀態，不會發request", () => {
    const fetchMock = stubJson({ ok: true, items: [] });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.items));

    expect(result.current.open).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("第一次展開會 fetch 一次並帶回資料", async () => {
    const fetchMock = stubJson({ ok: true, items: ["a", "b"] });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.items));

    await act(async () => {
      await result.current.toggle();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/thing/1");
    expect(result.current.open).toBe(true);
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
  });

  it("收合再展開第二次不會重新 fetch（cache 命中）", async () => {
    const fetchMock = stubJson({ ok: true, items: ["a"] });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.items));

    await act(async () => {
      await result.current.toggle(); // open + fetch
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.toggle(); // close, no fetch
    });
    expect(result.current.open).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.toggle(); // reopen, cached
    });
    expect(result.current.open).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(["a"]);
  });

  it("收合時 toggle 直接關閉，完全不呼叫 fetch", async () => {
    const fetchMock = stubJson({ ok: true, items: [] });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.items));

    await act(async () => {
      await result.current.toggle();
    });
    fetchMock.mockClear();

    await act(async () => {
      await result.current.toggle();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("後端回 ok:false 時顯示 error，且不快取（data 仍是 null）", async () => {
    stubJson({ ok: false, error: "讀取失敗了" });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.items));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.error).toBe("讀取失敗了");
    expect(result.current.data).toBeNull();
  });

  it("後端回傳 data 為 null（例如帳號已刪除）時，下次展開仍會重抓", async () => {
    const fetchMock = stubJson({ ok: true, winner: null });
    const { result } = renderHook(() => useLazyExpand(`/api/thing/1`, (p) => p.winner));

    await act(async () => {
      await result.current.toggle();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeNull();

    await act(async () => {
      await result.current.toggle(); // close
    });
    await act(async () => {
      await result.current.toggle(); // reopen — data was still null, so refetch
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
