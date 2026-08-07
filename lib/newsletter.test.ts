// Only buildNewsBroadcastHtml is covered here — it's the one pure/no-I/O
// export in this module (issue #73). Everything else in lib/newsletter.ts
// is a thin wrapper around resendRequest (lib/email.ts) with no branching
// worth unit-testing beyond what lib/email.ts itself already covers.

import { describe, expect, it } from "vitest";
import { buildNewsBroadcastHtml } from "./newsletter";

describe("buildNewsBroadcastHtml", () => {
  it("appends a 查看完整內容 link pointing at the detail URL after the content as-is", () => {
    const html = buildNewsBroadcastHtml("<p>本週競標時間調整為晚上八點</p>", "https://bid.j172.tw/news/42");

    expect(html).toContain("<p>本週競標時間調整為晚上八點</p>");
    expect(html).toContain('<a href="https://bid.j172.tw/news/42">查看完整內容</a>');
    // Content comes first, link appended after — not prepended.
    expect(html.indexOf("本週競標時間調整為晚上八點")).toBeLessThan(html.indexOf("查看完整內容"));
  });
});
