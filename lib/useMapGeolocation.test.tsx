// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GEOLOCATION_FALLBACK_CENTER, GEOLOCATION_ZOOM, useMapGeolocation } from "./useMapGeolocation";

function Probe() {
  const { geolocation, isLocating, relocate } = useMapGeolocation();
  return (
    <div>
      <div data-testid="out">
        {geolocation ? `${geolocation.center[0]},${geolocation.center[1]},${geolocation.zoom},${geolocation.isUserLocation}` : "pending"}
      </div>
      <div data-testid="locating">{String(isLocating)}</div>
      <button type="button" onClick={relocate}>
        relocate
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useMapGeolocation", () => {
  it("renders pending (null) and isLocating=true until the browser responds", () => {
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
    expect(screen.getByTestId("locating").textContent).toBe("true");
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
    expect(screen.getByTestId("locating").textContent).toBe("false");
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

  it("relocate() re-requests the position and updates the result", () => {
    let call = 0;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          call += 1;
          success({
            coords: call === 1 ? { latitude: 1, longitude: 2 } : { latitude: 3, longitude: 4 },
          } as GeolocationPosition);
        },
      },
    });

    render(<Probe />);
    expect(screen.getByTestId("out").textContent).toBe(`1,2,${GEOLOCATION_ZOOM},true`);

    fireEvent.click(screen.getByRole("button", { name: "relocate" }));
    expect(screen.getByTestId("out").textContent).toBe(`3,4,${GEOLOCATION_ZOOM},true`);
    expect(call).toBe(2);
  });

  it("relocate() never resets geolocation back to null (would tear down an already-mounted map)", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
        },
      },
    });

    render(<Probe />);
    expect(screen.getByTestId("out").textContent).not.toBe("pending");

    fireEvent.click(screen.getByRole("button", { name: "relocate" }));
    expect(screen.getByTestId("out").textContent).not.toBe("pending");
  });

  it("relocate() falls back cleanly when a later attempt is denied after an earlier success", () => {
    let call = 0;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
          call += 1;
          if (call === 1) {
            success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
          } else {
            error({ code: 1, message: "denied" } as GeolocationPositionError);
          }
        },
      },
    });

    render(<Probe />);
    expect(screen.getByTestId("out").textContent).toBe(`1,2,${GEOLOCATION_ZOOM},true`);

    fireEvent.click(screen.getByRole("button", { name: "relocate" }));
    const [lat, lng] = GEOLOCATION_FALLBACK_CENTER;
    expect(screen.getByTestId("out").textContent).toBe(`${lat},${lng},${GEOLOCATION_ZOOM},false`);
  });
});
