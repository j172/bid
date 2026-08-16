// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useImageUploadPreview } from "./useImageUploadPreview";

// 這個 hook 被最新訊息、入賞鴿／進口鴿、合作鴿舍三個表單 modal 共用
// （issue #139 M26），原本完全沒有測試覆蓋。重點鎖住三件事：選檔後預覽正確
// 顯示、換掉舊檔或 reset 時舊的 blob: URL 有被釋放，避免累積洩漏。

function makeFile(name = "photo.png"): File {
  return new File(["fake-bytes"], name, { type: "image/png" });
}

function TestHarness({ initialUrl }: { initialUrl: string | null }) {
  const { fileInputRef, previewUrl, handleFileChange, reset, selectedFile } = useImageUploadPreview(initialUrl);
  return (
    <div>
      <input data-testid="file-input" type="file" ref={fileInputRef} onChange={handleFileChange} />
      <span data-testid="preview">{previewUrl ?? "none"}</span>
      <span data-testid="selected">{selectedFile()?.name ?? "none"}</span>
      <button type="button" onClick={reset}>
        reset
      </button>
    </div>
  );
}

let objectUrlCounter = 0;
const createObjectURL = vi.fn(() => `blob:mock-${++objectUrlCounter}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  objectUrlCounter = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useImageUploadPreview", () => {
  it("初始時預覽顯示 initialUrl", () => {
    const { getByTestId } = render(<TestHarness initialUrl="/uploads/existing.png" />);
    expect(getByTestId("preview").textContent).toBe("/uploads/existing.png");
  });

  it("選檔後立刻顯示 blob 預覽，且 selectedFile() 拿得到該檔案", () => {
    const { getByTestId } = render(<TestHarness initialUrl="/uploads/existing.png" />);
    const input = getByTestId("file-input") as HTMLInputElement;
    const file = makeFile();

    fireEvent.change(input, { target: { files: [file] } });

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(getByTestId("preview").textContent).toBe("blob:mock-1");
    expect(getByTestId("selected").textContent).toBe("photo.png");
  });

  it("換掉舊圖時會 revoke 前一個 blob: URL", () => {
    const { getByTestId } = render(<TestHarness initialUrl={null} />);
    const input = getByTestId("file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile("first.png")] } });
    expect(getByTestId("preview").textContent).toBe("blob:mock-1");
    expect(revokeObjectURL).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [makeFile("second.png")] } });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
    expect(getByTestId("preview").textContent).toBe("blob:mock-2");
  });

  it("初始圖非 blob: 時，第一次選檔不會呼叫 revoke（沒有東西可回收）", () => {
    const { getByTestId } = render(<TestHarness initialUrl="/uploads/existing.png" />);
    const input = getByTestId("file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile()] } });

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("reset() 會 revoke 目前的 blob 並還原成 initialUrl（Modal 關閉情境）", () => {
    const { getByTestId, getByText } = render(<TestHarness initialUrl="/uploads/existing.png" />);
    const input = getByTestId("file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile()] } });
    expect(getByTestId("preview").textContent).toBe("blob:mock-1");

    fireEvent.click(getByText("reset"));

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
    expect(getByTestId("preview").textContent).toBe("/uploads/existing.png");
  });

  it("reset() 時 initialUrl 為 null（新增模式）則預覽還原成 none", () => {
    const { getByTestId, getByText } = render(<TestHarness initialUrl={null} />);
    const input = getByTestId("file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeFile()] } });
    fireEvent.click(getByText("reset"));

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
    expect(getByTestId("preview").textContent).toBe("none");
  });
});
