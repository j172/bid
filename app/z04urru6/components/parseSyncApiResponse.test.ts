// issue #261: parseSyncApiResponse must never let a raw JSON.parse exception
// (from response.json() on a non-JSON body) escape to its caller — every
// case below resolves rather than throws.
import { describe, expect, it } from "vitest";
import { parseSyncApiResponse } from "./parseSyncApiResponse";

function fakeResponse(init: {
  ok: boolean;
  status?: number;
  contentType?: string | null;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? (init.contentType ?? null) : null) },
    json: init.json ?? (async () => ({})),
  } as unknown as Response;
}

describe("parseSyncApiResponse", () => {
  it("parses and returns the body when the response is ok JSON", async () => {
    const response = fakeResponse({
      ok: true,
      contentType: "application/json; charset=utf-8",
      json: async () => ({ ok: true, result: { imported: 3 } }),
    });

    const parsed = await parseSyncApiResponse<{ ok: boolean; result: { imported: number } }>(response);

    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual({ ok: true, result: { imported: 3 } });
    expect(parsed.message).toBeUndefined();
  });

  it("returns a clear message instead of throwing when the reverse proxy returns an HTML timeout page", async () => {
    const response = fakeResponse({
      ok: false,
      status: 504,
      contentType: "text/html",
      json: async () => {
        throw new SyntaxError("Unexpected token '<', \"<html>...\" is not valid JSON");
      },
    });

    const parsed = await parseSyncApiResponse(response);

    expect(parsed.ok).toBe(false);
    expect(parsed.message).toContain("504");
    expect(parsed.message).not.toContain("Unexpected token");
  });

  it("returns a clear message when content-type is missing/non-JSON even on a 200", async () => {
    const response = fakeResponse({ ok: true, status: 200, contentType: "text/plain" });

    const parsed = await parseSyncApiResponse(response);

    expect(parsed.ok).toBe(false);
    expect(parsed.message).toContain("200");
  });

  it("returns a clear message when content-type claims JSON but the body fails to parse", async () => {
    const response = fakeResponse({
      ok: true,
      contentType: "application/json",
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    const parsed = await parseSyncApiResponse(response);

    expect(parsed.ok).toBe(false);
    expect(parsed.message).toBeTruthy();
  });
});
