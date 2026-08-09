// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { useConfirmedAction } from "./useConfirmedAction";

// 這個 hook 被 9 個後台按鈕共用（issue #139 H4），router.refresh 是它成功後
// 唯一的副作用，所以直接把 useRouter 換成一顆 spy。
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function stubJson(payload: unknown) {
  const fetchMock = vi.fn(async () => ({ json: async () => payload }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  refresh.mockClear();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const baseOptions = {
  confirmMessage: "確定嗎？",
  endpoint: "/api/admin/thing/1/do",
  method: "POST" as const,
  errorFallback: "操作失敗",
};

describe("useConfirmedAction", () => {
  it("使用者在確認視窗按取消時完全不送出請求", async () => {
    const fetchMock = stubJson({ ok: true });
    vi.stubGlobal("confirm", vi.fn(() => false));

    const { result } = renderHook(() => useConfirmedAction(baseOptions));
    await act(async () => {
      await result.current.run();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("成功時 refresh 頁面且不顯示錯誤", async () => {
    const fetchMock = stubJson({ ok: true });

    const { result } = renderHook(() => useConfirmedAction(baseOptions));
    await act(async () => {
      await result.current.run();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/thing/1/do", { method: "POST" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it("後端回 ok:false 時顯示 data.error，且不 refresh", async () => {
    stubJson({ ok: false, error: "已有出價，無法下架" });

    const { result } = renderHook(() => useConfirmedAction(baseOptions));
    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe("已有出價，無法下架");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("後端沒給 error 字串時退回 errorFallback", async () => {
    stubJson({ ok: false });

    const { result } = renderHook(() => useConfirmedAction(baseOptions));
    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe("操作失敗");
  });

  it("有 body 時以 JSON 送出", async () => {
    const fetchMock = stubJson({ ok: true });

    const { result } = renderHook(() => useConfirmedAction({ ...baseOptions, body: { role: "admin" } }));
    await act(async () => {
      await result.current.run();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/thing/1/do", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
  });

  it("refreshOnSuccess:false 時只顯示成功訊息、不 refresh", async () => {
    stubJson({ ok: true, email: "someone@example.com" });

    const { result } = renderHook(() =>
      useConfirmedAction({
        ...baseOptions,
        refreshOnSuccess: false,
        successMessage: (data) => `已寄出重設密碼信至 ${String(data.email)}`,
      }),
    );
    await act(async () => {
      await result.current.run();
    });

    expect(result.current.success).toBe("已寄出重設密碼信至 someone@example.com");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("重試成功時會清掉上一次的錯誤訊息", async () => {
    stubJson({ ok: false, error: "暫時失敗" });

    const { result } = renderHook(() => useConfirmedAction(baseOptions));
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe("暫時失敗");

    stubJson({ ok: true });
    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
