// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { GEOLOCATION_FALLBACK_CENTER, GEOLOCATION_ZOOM, useMapGeolocation } from "./useMapGeolocation";

function Probe() {
  const result = useMapGeolocation();
  if (!result) return <div data-testid="out">pending</div>;
  return (
    <div data-testid="out">
      {result.center[0]},{result.center[1]},{result.zoom},{String(result.isUserLocation)}
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useMapGeolocation", () => {
  it("renders pending (null) until the browser responds", () => {
    let capturedSuccess: PositionCallback | undefined;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          capturedSuccess = success;
        }),
      },
    });

    render(<Probe />);
    expect(screen.getByTestId("out").textContent).toBe("pending");
    expect(capturedSuccess).toBeDefined();
  });

  it("centers on the user at city-level zoom when geolocation succeeds", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: { latitude: 25.033, longitude: 121.5654 },
          } as GeolocationPosition);
        },
      },
    });

    render(<Probe />);
    expect(screen.getByTestId("out").textContent).toBe(`25.033,121.5654,${GEOLOCATION_ZOOM},true`);
  });

  it("falls back to Chiayi City Government at the same zoom when geolocation is denied", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
          error({ code: 1, message: "User denied Geolocation" } as GeolocationPositionError);
        },
      },
    });

    render(<Probe />);
    const [lat, lng] = GEOLOCATION_FALLBACK_CENTER;
    expect(screen.getByTestId("out").textContent).toBe(`${lat},${lng},${GEOLOCATION_ZOOM},false`);
  });

  it("falls back to Chiayi City Government when the browser has no Geolocation API", () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined });

    render(<Probe />);
    const [lat, lng] = GEOLOCATION_FALLBACK_CENTER;
    expect(screen.getByTestId("out").textContent).toBe(`${lat},${lng},${GEOLOCATION_ZOOM},false`);
  });

  it("does not update state after unmount (no act() warning) once geolocation resolves late", async () => {
    let capturedSuccess: PositionCallback | undefined;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          capturedSuccess = success;
        }),
      },
    });

    const { unmount } = render(<Probe />);
    unmount();

    expect(() => {
      act(() => {
        capturedSuccess?.({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
      });
    }).not.toThrow();
  });
});
