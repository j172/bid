// Only extractRaceDate/deriveLoingMaStatus/parseLoingMaForumPage are pure
// logic worth a focused test — everything else in lib/loingMaRaces.ts is
// thin Playwright I/O wiring (no test), same precedent as
// lib/herbotsNews.test.ts covering only toSummary.
import { describe, expect, it } from "vitest";
import { deriveLoingMaStatus, extractRaceDate, parseLoingMaForumPage } from "./loingMaRaces";

describe("extractRaceDate", () => {
  it("parses a full YYYY-MM-DD leading date", () => {
    const date = extractRaceDate("2026-07-05南海夏季第三關天氣", new Date("2026-07-05T08:07:14"));
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // 0-indexed: July
    expect(date.getDate()).toBe(5);
  });

  it("parses a non-zero-padded YYYY-M-D date", () => {
    const date = extractRaceDate("2025-11-9冬季第四關天氣", new Date("2025-11-09T07:00:00"));
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(9);
  });

  it("infers the year from the post date when the title omits it", () => {
    const date = extractRaceDate("7-20第五關颱風延關", new Date("2025-07-21T09:00:00"));
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(20);
  });

  it("falls back to the post date when the title has no parseable date at all", () => {
    const postedAt = new Date("2026-01-01T12:00:00");
    const date = extractRaceDate("公告：本週停賽", postedAt);
    expect(date).toEqual(postedAt);
  });
});

describe("deriveLoingMaStatus", () => {
  it("returns 'current' when the race date is today (Asia/Taipei)", () => {
    const now = new Date("2026-09-12T04:00:00Z"); // 12:00 Taipei
    const raceDate = new Date(2026, 8, 12);
    expect(deriveLoingMaStatus(raceDate, now)).toBe("current");
  });

  it("returns 'finished' when the race date is before today", () => {
    const now = new Date("2026-09-12T04:00:00Z");
    const raceDate = new Date(2026, 6, 5);
    expect(deriveLoingMaStatus(raceDate, now)).toBe("finished");
  });

  it("returns 'future' when the race date is after today", () => {
    const now = new Date("2026-09-12T04:00:00Z");
    const raceDate = new Date(2026, 11, 25);
    expect(deriveLoingMaStatus(raceDate, now)).toBe("future");
  });
});

describe("parseLoingMaForumPage", () => {
  const FIXTURE = `
    <div class="row">
      <div class="col-4"></div>
      <div class="col-8 text-end">第 <strong>1</strong> 頁 (共 <strong>6</strong> 頁)</div>
    </div>
    <div class="row">
      <div class="col-md-4 col-sm-5">
        <div class="topic_img">
          <a href="./viewtopic.php?f=80&amp;t=12743&amp;sid=abc123"><img src="./index/images/nophoto.jpg"></a>
        </div>
      </div>
      <div class="col-md-8 col-sm-7">
        <h4><a href="./viewtopic.php?f=80&amp;t=12743&amp;sid=abc123" class="topictitle">2026-07-05南海夏季第三關天氣</a></h4>
        <div class="text-box">
          <p class="topic_text gen">南海聯合船隊通知：115年夏季第三關 7/5 天氣：晴天，於6:30準時放鴿。</p>
          <div class="row">
            <div class="col-6"><span class="time"><i class="fa-xs far fa-calendar-alt"></i> 2026-07-05 08:07:14</span></div>
            <div class="col-6 text-end gensmall">瀏覽數：<span class="views">632</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  it("extracts topic id, title, content, and canonical (sid-stripped) source URL", () => {
    const topics = parseLoingMaForumPage(FIXTURE);

    expect(topics).toHaveLength(1);
    expect(topics[0]).toEqual({
      topicId: 12743,
      title: "2026-07-05南海夏季第三關天氣",
      contentText: "南海聯合船隊通知：115年夏季第三關 7/5 天氣：晴天，於6:30準時放鴿。",
      postedAt: new Date("2026-07-05T08:07:14"),
      sourceUrl: "https://www.loing-ma.com/viewtopic.php?f=80&t=12743",
    });
  });

  it("ignores rows with no topictitle link (e.g. the pagination row)", () => {
    const topics = parseLoingMaForumPage(`<div class="row"><div class="col-4"></div></div>`);
    expect(topics).toEqual([]);
  });

  it("returns an empty array for a page with no topics", () => {
    expect(parseLoingMaForumPage("<html><body></body></html>")).toEqual([]);
  });
});
