// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import L from "leaflet";
import { getPigeonMapIcon, PIGEON_MAP_ICON_OPTIONS } from "./pigeonMapIcon";

describe("pigeonMapIcon", () => {
  it("configures same-origin icon and shadow URLs", () => {
    expect(PIGEON_MAP_ICON_OPTIONS.iconUrl).toBe("/images/leaflet/marker-icon.png");
    expect(PIGEON_MAP_ICON_OPTIONS.iconRetinaUrl).toBe("/images/leaflet/marker-icon-2x.png");
    expect(PIGEON_MAP_ICON_OPTIONS.shadowUrl).toBe("/images/leaflet/marker-shadow.png");
    expect(PIGEON_MAP_ICON_OPTIONS.iconSize).toEqual([25, 41]);
    expect(PIGEON_MAP_ICON_OPTIONS.iconAnchor).toEqual([12, 41]);
    expect(PIGEON_MAP_ICON_OPTIONS.popupAnchor).toEqual([1, -34]);
    expect(PIGEON_MAP_ICON_OPTIONS.shadowSize).toEqual([41, 41]);
  });

  it("returns a valid L.Icon instance and caches it across calls", () => {
    const icon1 = getPigeonMapIcon();
    const icon2 = getPigeonMapIcon();

    expect(icon1).toBeInstanceOf(L.Icon);
    expect(icon1).toBe(icon2);
    expect(icon1.options.iconUrl).toBe("/images/leaflet/marker-icon.png");
  });
});
