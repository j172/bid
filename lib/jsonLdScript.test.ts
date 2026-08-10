// Pure string function, no mocking needed — same directly-unit-testable
// shape as lib/htmlText.test.ts.
import { describe, expect, it } from "vitest";
import { safeJsonLdString } from "./jsonLdScript";

describe("safeJsonLdString", () => {
  it("escapes a </script> payload so it can never close the surrounding script element", () => {
    const output = safeJsonLdString({ name: "</script><script>alert(1)</script>" });

    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<");
    expect(output).not.toContain(">");
    expect(output).toContain("\\u003c");
  });

  it("round-trips back to the original object — the escaping is invisible to any JSON parser", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "</script><img src=x onerror=alert(1)> & <b>鴿</b>",
      offers: { price: 1200, url: "https://example.com/listings/1?a=1&b=2" },
    };

    expect(JSON.parse(safeJsonLdString(value))).toEqual(value);
  });

  it("escapes bare < > & anywhere in the document, including inside keys", () => {
    const output = safeJsonLdString({ "a<b": "c>d&e" });

    expect(output).toBe('{"a\\u003cb":"c\\u003ed\\u0026e"}');
  });

  it("leaves output with no escapable characters untouched apart from being valid JSON", () => {
    expect(safeJsonLdString({ name: "台灣賽鴿", price: 1200 })).toBe('{"name":"台灣賽鴿","price":1200}');
  });
});
