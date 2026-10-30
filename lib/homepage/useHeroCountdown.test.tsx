// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useHeroCountdown } from "./useHeroCountdown";

function Probe({ targetIso, renderedAt }: { targetIso: string; renderedAt: string }) {
  const { days, hours, minutes, seconds } = useHeroCountdown(targetIso, renderedAt);
  return <div data-testid="out">{`${days}:${hours}:${minutes}:${seconds}`}</div>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useHeroCountdown", () => {
  it("ticks every second when under a day remains", () => {
    vi.useFakeTimers();
    const renderedAt = new Date("2026-08-07T00:00:00.000Z").toISOString();
    vi.setSystemTime(new Date(renderedAt));
    const targetIso = new Date(new Date(renderedAt).getTime() + 5_000).toISOString();

    render(<Probe targetIso={targetIso} renderedAt={renderedAt} />);
    const readings = [screen.getByTestId("out").textContent];
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      readings.push(screen.getByTestId("out").textContent);
    }

    // Every consecutive pair must differ — proves a genuine 1s tick, not a
    // frozen/throttled countdown.
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).not.toBe(readings[i - 1]);
    }
  });

  // Regression test for issue #71: an earlier version of this hook slowed
  // its tick to once a minute once >= 1 day remained (reasoning that a
  // day/hour-granularity *display* wouldn't visibly change more often).
  // That's true for the sentence-style "剩餘 X 天 X 小時" text, but the
  // hero's digit-tile display always shows a live seconds tile regardless
  // of how much time remains, so throttling the hook itself made that tile
  // sit frozen for up to 60s at a time — reported as "not ticking" on
  // production. The hook must tick every second unconditionally; call
  // sites that want coarser *display* granularity do that in their own
  // formatting (see RemainingText in HeroSection.tsx), not by asking this
  // hook to update less often.
  it("still ticks every second (not throttled) when a day or more remains", () => {
    vi.useFakeTimers();
    const renderedAt = new Date("2026-08-07T00:00:00.000Z").toISOString();
    vi.setSystemTime(new Date(renderedAt));
    const targetIso = new Date(new Date(renderedAt).getTime() + 3 * 86_400_000).toISOString(); // 3 days out

    render(<Probe targetIso={targetIso} renderedAt={renderedAt} />);
    const first = screen.getByTestId("out").textContent;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const second = screen.getByTestId("out").textContent;

    expect(second).not.toBe(first);
  });

  it("clamps to ended (all-zero remaining) once the target has passed", () => {
    vi.useFakeTimers();
    const renderedAt = new Date("2026-08-07T00:00:00.000Z").toISOString();
    vi.setSystemTime(new Date(renderedAt));
    const targetIso = new Date(new Date(renderedAt).getTime() - 1_000).toISOString(); // already past

    render(<Probe targetIso={targetIso} renderedAt={renderedAt} />);
    expect(screen.getByTestId("out").textContent).toBe("0:0:0:0");
  });
});
