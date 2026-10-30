// Pure string function, no mocking needed.
import { describe, expect, it } from "vitest";
import { csvEscape } from "./csv";

describe("csvEscape", () => {
  it("leaves an ordinary value untouched", () => {
    expect(csvEscape("台灣賽鴿")).toBe("台灣賽鴿");
    expect(csvEscape(1200)).toBe("1200");
    expect(csvEscape("visitor@example.com")).toBe("visitor@example.com");
  });

  it("quotes and doubles up embedded quotes (RFC 4180)", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes values containing a comma or a newline", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("neutralises spreadsheet formulas by prefixing a single quote (issue #140 M-2)", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-1234")).toBe("'-1234");
    expect(csvEscape("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });

  it("guards a formula that also needs quoting, in that order", () => {
    // The winner-email column is the real attack path: a registered address
    // lands in the CSV verbatim, so a formula there would run on open.
    expect(csvEscape('=cmd|" /C calc"!A0')).toBe('"\'=cmd|"" /C calc""!A0"');
    expect(csvEscape("=HYPERLINK(\"http://evil\",A1)")).toBe('"\'=HYPERLINK(""http://evil"",A1)"');
  });

  it("guards a formula hidden behind leading whitespace some importers strip", () => {
    expect(csvEscape("\t=1+1")).toBe("'\t=1+1");
  });

  it("does not touch a minus sign that isn't leading", () => {
    expect(csvEscape("a-b")).toBe("a-b");
  });
});
