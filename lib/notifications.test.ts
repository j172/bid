import { describe, expect, it } from "vitest";
import { buildContactAdminNotificationHtml, resolveContactAdminEmail } from "./notifications";

// Only the pure email-composition helper is tested here — the rest of this
// module is DB/network-calling glue (getDb/sendEmail), which this repo
// doesn't unit test (see e.g. lib/newsletter.ts's buildNewsBroadcastHtml
// being the only tested export of that file too).
describe("buildContactAdminNotificationHtml", () => {
  it("includes the submitted name, email, subject, and message", () => {
    const html = buildContactAdminNotificationHtml({
      name: "王小明",
      email: "test@example.com",
      subject: "詢問訂單",
      message: "請問出貨了嗎？",
    });

    expect(html).toContain("王小明");
    expect(html).toContain("test@example.com");
    expect(html).toContain("詢問訂單");
    expect(html).toContain("請問出貨了嗎？");
  });

  it("escapes HTML-significant characters in every field", () => {
    const html = buildContactAdminNotificationHtml({
      name: `<img src=x onerror=alert(1)>`,
      email: "test@example.com",
      subject: `"><script>alert(2)</script>`,
      message: "safe & sound",
    });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("safe &amp; sound");
  });

  it("converts newlines in the message to <br> for HTML display", () => {
    const html = buildContactAdminNotificationHtml({
      name: "王小明",
      email: "test@example.com",
      subject: "主旨",
      message: "第一行\n第二行",
    });

    expect(html).toContain("第一行<br>第二行");
  });
});

// The contact form's admin notification is a receiving end: if this resolves
// to the wrong address, customer enquiries are lost with no visible symptom.
// The fallback defaults to service@xiangshuicn.cc when no env override is set.
describe("resolveContactAdminEmail", () => {
  it("falls back to the default recipient when no env override is set", () => {
    expect(resolveContactAdminEmail({})).toBe("service@xiangshuicn.cc");
  });

  it("uses CONTACT_ADMIN_EMAIL when set", () => {
    expect(resolveContactAdminEmail({ CONTACT_ADMIN_EMAIL: "service@xiangshuicn.cc" })).toBe(
      "service@xiangshuicn.cc",
    );
  });

  it("ignores a blank/whitespace-only override so a copied-but-unfilled .env cannot black-hole notifications", () => {
    expect(resolveContactAdminEmail({ CONTACT_ADMIN_EMAIL: "" })).toBe("service@xiangshuicn.cc");
    expect(resolveContactAdminEmail({ CONTACT_ADMIN_EMAIL: "   " })).toBe("service@xiangshuicn.cc");
  });

  it("trims surrounding whitespace from a configured address", () => {
    expect(resolveContactAdminEmail({ CONTACT_ADMIN_EMAIL: "  service@xiangshuicn.cc  " })).toBe(
      "service@xiangshuicn.cc",
    );
  });
});
