import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_CRAWLER_INTRO, OG_TITLE, SITE_DESCRIPTION, SITE_TITLE, homeJsonLd } from "./siteCopy.ts";
import * as C from "../about/content.ts";
import { TEST_PAGES } from "../about/testPages.ts";

// 사업자 표시("대표 김준석")와 개인정보 보호책임자는 법정 표시라 SiteFooter·/legal에 남는다 — 여기서는 소개 글만 본다.
const TEAM_NAMES = /김준석|곽혜진|오세민|오유주/;

test("홈 검색 제목·설명은 대표님이 2026-11-21에 정한 문구 그대로, 링크 미리보기 제목도 같게(2026-11-27)", () => {
  assert.equal(SITE_TITLE, "쏘웰라 AI | 심리상담 전문가가 설계한 나만의 비밀친구, 가입하면 3일 무료");
  assert.match(SITE_DESCRIPTION, /^이유 없이 지칠 때, 전남친과 재회하고 싶을 때, 무턱대고 회사 그만두고 싶을 때에도 언제든지/);
  assert.match(SITE_DESCRIPTION, /가입하면 3일 무료\.$/);
  assert.equal(OG_TITLE, SITE_TITLE);
  assert.doesNotMatch(OG_TITLE, /내 손안의 상담사/);
});

test("소개 글(쏘웰라 /about · 테스트 소개 · 크롤러용 홈 소개)에 팀원 이름이 없다 — 직함과 자격만", () => {
  assert.doesNotMatch(JSON.stringify(C), TEAM_NAMES);
  assert.doesNotMatch(JSON.stringify(TEST_PAGES), TEAM_NAMES);
  assert.doesNotMatch(HOME_CRAWLER_INTRO.join(" "), TEAM_NAMES);
  assert.ok(C.MAKERS.every((m) => m.items.length === 1 && m.items[0][0] === "자격"));
});

test("크롤러용 홈 소개는 /about에 이미 있는 문장만 쓴다", () => {
  assert.equal(HOME_CRAWLER_INTRO[0], C.ABOUT_INTRO);
  assert.match(HOME_CRAWLER_INTRO[1], /자격을 가진 대표와 산업심리상담사 1급 자격을 가진 CSO가/);
});

test("홈 구조화 데이터: 설명은 검색 설명과 같고, 날짜·가격은 넣지 않는다", () => {
  const ld = homeJsonLd();
  assert.equal(ld.description, SITE_DESCRIPTION);
  const s = JSON.stringify(ld);
  assert.doesNotMatch(s, /offers|price|date|\d{4}[-.]\d{2}/i);
  assert.doesNotThrow(() => JSON.parse(s));
});
