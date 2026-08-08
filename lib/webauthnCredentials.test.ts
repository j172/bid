// lib/webauthnCredentials.ts mixes pure functions (encodeTransports/
// decodeTransports — tested directly with no mocking) with raw-SQL CRUD
// (listPasskeysForUser/findCredentialById/saveCredential/deleteCredential/
// etc), which — like lib/emailOtp.test.ts — mocks @/lib/db's getDb() and
// asserts on the SQL/params each function sends. queryMock is created via
// vi.hoisted so it exists before vi.mock's factory below runs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import {
  decodeTransports,
  deleteCredential,
  encodeTransports,
  findCredentialById,
  listCredentialDescriptorsForUser,
  listPasskeysForUser,
  saveCredential,
  updateCredentialAfterLogin,
} from "./webauthnCredentials";

beforeEach(() => {
  queryMock.mockReset();
});

describe("encodeTransports", () => {
  it("returns null for undefined", () => {
    expect(encodeTransports(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(encodeTransports([])).toBeNull();
  });

  it("returns the JSON serialization of a non-empty array", () => {
    expect(encodeTransports(["internal", "hybrid"])).toBe(JSON.stringify(["internal", "hybrid"]));
  });
});

describe("decodeTransports", () => {
  it("returns undefined for null", () => {
    expect(decodeTransports(null)).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    expect(decodeTransports("not json")).toBeUndefined();
  });

  it("returns undefined for valid JSON that isn't an array", () => {
    expect(decodeTransports(JSON.stringify({ not: "an array" }))).toBeUndefined();
  });

  it("round-trips whatever encodeTransports produced", () => {
    const encoded = encodeTransports(["usb", "nfc"]);
    expect(decodeTransports(encoded)).toEqual(["usb", "nfc"]);
  });
});

describe("listCredentialDescriptorsForUser", () => {
  it("maps rows to id/transports descriptors for excludeCredentials", async () => {
    queryMock.mockResolvedValueOnce([
      [
        { credential_id: "cred-1", transports: JSON.stringify(["internal"]) },
        { credential_id: "cred-2", transports: null },
      ],
    ]);
    const result = await listCredentialDescriptorsForUser(7);
    expect(result).toEqual([
      { id: "cred-1", transports: ["internal"] },
      { id: "cred-2", transports: undefined },
    ]);
    expect(queryMock.mock.calls[0][1]).toEqual([7]);
  });
});

describe("listPasskeysForUser", () => {
  it("maps rows to PasskeySummary, newest first per the query's ORDER BY", async () => {
    const createdAt = new Date("2026-08-01T00:00:00Z");
    const lastUsedAt = new Date("2026-08-05T00:00:00Z");
    queryMock.mockResolvedValueOnce([
      [{ credential_id: "cred-1", device_name: "我的 iPhone", created_at: createdAt, last_used_at: lastUsedAt }],
    ]);
    const result = await listPasskeysForUser(7);
    expect(result).toEqual([
      { credentialId: "cred-1", deviceName: "我的 iPhone", createdAt, lastUsedAt },
    ]);
    expect(queryMock.mock.calls[0][0]).toContain("ORDER BY created_at DESC");
    expect(queryMock.mock.calls[0][1]).toEqual([7]);
  });
});

describe("findCredentialById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await findCredentialById("nope")).toBeNull();
  });

  it("decodes the stored public key/transports into a WebAuthnCredential", async () => {
    queryMock.mockResolvedValueOnce([
      [
        {
          credential_id: "cred-1",
          user_id: 9,
          public_key: Buffer.from([1, 2, 3]).toString("base64url"),
          counter: 4,
          device_name: "我的 iPhone",
          transports: JSON.stringify(["internal"]),
          created_at: new Date(),
          last_used_at: null,
        },
      ],
    ]);
    const result = await findCredentialById("cred-1");
    expect(result?.userId).toBe(9);
    expect(result?.credential.id).toBe("cred-1");
    expect(result?.credential.counter).toBe(4);
    expect(result?.credential.transports).toEqual(["internal"]);
    expect(Buffer.from(result!.credential.publicKey)).toEqual(Buffer.from([1, 2, 3]));
  });
});

describe("saveCredential", () => {
  it("inserts the credential id/publicKey/counter/deviceName/transports", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await saveCredential(
      7,
      { id: "cred-1", publicKey: new Uint8Array([9, 9, 9]), counter: 0, transports: ["usb"] },
      "我的 iPhone",
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO webauthn_credentials");
    expect(params[0]).toBe("cred-1");
    expect(params[1]).toBe(7);
    expect(Buffer.from(params[2], "base64url")).toEqual(Buffer.from([9, 9, 9]));
    expect(params[3]).toBe(0);
    expect(params[4]).toBe("我的 iPhone");
    expect(params[5]).toBe(JSON.stringify(["usb"]));
  });

  it("persists a null device name as-is", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await saveCredential(7, { id: "cred-1", publicKey: new Uint8Array([1]), counter: 0 }, null);
    expect(queryMock.mock.calls[0][1][4]).toBeNull();
  });
});

describe("updateCredentialAfterLogin", () => {
  it("updates the counter and stamps last_used_at", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    await updateCredentialAfterLogin("cred-1", 5);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW()");
    expect(params).toEqual([5, "cred-1"]);
  });
});

describe("deleteCredential", () => {
  it("scopes the delete to both credentialId and userId", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await deleteCredential("cred-1", 7);
    expect(result).toEqual({ ok: true });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toBe("DELETE FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?");
    expect(params).toEqual(["cred-1", 7]);
  });

  it("returns NOT_FOUND when nothing matched (wrong owner or unknown id)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await deleteCredential("cred-1", 7);
    expect(result).toEqual({ ok: false, errorCode: "NOT_FOUND" });
  });
});
