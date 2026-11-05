import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TAROT_BUTTON, TAROT_URL, TEST_PAGES, TEST_PAGE_LIST, testPageJsonLd, type Block } from "./testPages.ts";
import { PUBLIC_PATHS } from "../seo/paths.ts";

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
  return out;
}
const textOf = (p: (typeof TEST_PAGE_LIST)[number]) => collect(p).join("\n");

describe("테스트 소개 페이지(디저트·아스트로·타로) 글", () => {
  test("세 페이지가 각자 주소(slug)·원본 주소·테스트 버튼 링크를 갖는다", () => {
    assert.deepEqual(TEST_PAGE_LIST.map((p) => p.slug), ["dessert", "astro", "tarot"]);
    assert.equal(TEST_PAGES.dessert.testUrl, "https://quiz.ssolwellnesshouse.com/");
    assert.equal(TEST_PAGES.astro.testUrl, "https://astro.ssolwellnesshouse.com/test");
    assert.equal(TEST_PAGES.tarot.testUrl, "https://tarot.ssolwellnesshouse.com/");
    assert.equal(TEST_PAGES.dessert.canonical, "https://quiz.ssolwellnesshouse.com/about");
    assert.equal(TEST_PAGES.astro.canonical, "https://astro.ssolwellnesshouse.com/about");
    assert.equal(TEST_PAGES.tarot.canonical, "https://tarot.ssolwellnesshouse.com/about");
    assert.equal(TEST_PAGES.tarot.testButton, "타로 테스트 보러 가기");
    for (const p of TEST_PAGE_LIST) assert.ok(p.testButton.endsWith("테스트 보러 가기"), p.slug);
  });

  test("원본이 각 테스트 사이트라 앱의 소개 주소는 사이트맵(공개 주소 목록)에 넣지 않는다", () => {
    for (const p of TEST_PAGE_LIST) assert.equal((PUBLIC_PATHS as readonly string[]).includes(`/about/${p.slug}`), false);
  });

  test("기획 초안의 출처 표기·검토 표시·참여자 수 자리표시가 화면 글에 남아 있지 않다", () => {
    for (const p of TEST_PAGE_LIST) {
      const all = textOf(p);
      for (const mark of ["(자료", "(홈", "(IR", "⚠️", "⏸", "✅", "CONFIDENTIAL", "[n]", "[기준일]"]) assert.equal(all.includes(mark), false, `${p.slug}: ${mark}`);
    }
  });

  test("문서가 '외부에 쓰지 않은 정보'로 정한 것(재무·광고 성과·휴먼 세션 가격 등)이 들어 있지 않다", () => {
    const banned = ["밸류에이션", "Pre-money", "시드", "광고비", "클릭당", "142만", "7,867", "1,023명", "68원", "80,000원", "640,000", "TAM", "NHN", "KOTRA", "해양생물"];
    for (const p of TEST_PAGE_LIST) {
      const all = textOf(p);
      for (const w of banned) assert.equal(all.includes(w), false, `${p.slug}: ${w}`);
    }
  });

  test("쏘웰라의 내부 품질 수치(퍼센트 등)는 테스트 페이지에 쓰지 않는다 — 테스트의 정확도로 오해된다", () => {
    for (const p of TEST_PAGE_LIST) {
      assert.equal(/\d+(\.\d+)?\s*%/.test(textOf(p)), false, p.slug);
      assert.equal(/0\/44|97\.4|98\.3|97\.0/.test(textOf(p)), false, p.slug);
    }
  });

  test("아직 확정 전이라 뺀 항목(아스트로 '출생 시간을 모를 때' FAQ)은 확정되기 전까지 없다", () => {
    assert.equal(TEST_PAGES.astro.faq.flatMap((g) => g.items).some((f) => f.q.includes("출생 시간을 몰라도")), false);
  });

  test("디저트 페이지는 게시된 원본 기준이다: 영역·대처 방식 이름, 무료 범위(궁합 카드·웰니스 프로파일), 가입 없이 결제 가능", () => {
    const dessert = textOf(TEST_PAGES.dessert);
    for (const w of ["진로(커리어)", "용기형(직접 바꾸기)", "평온형(다르게 보기)", "유보형(거리두기)", "궁합 카드", "웰니스 프로파일", "가입 없이 결제할 수 있어요"]) assert.ok(dessert.includes(w), w);
  });

  test("가격과 이용권 기간이 문서(2026-11-05)와 같다: 디저트 3,500원·7일, 아스트로 1,900원·3일, 타로 990원·3일", () => {
    assert.ok(textOf(TEST_PAGES.dessert).includes("3,500원"));
    assert.ok(textOf(TEST_PAGES.dessert).includes("쏘웰라 7일 이용권"));
    assert.ok(textOf(TEST_PAGES.astro).includes("1,900원") && textOf(TEST_PAGES.astro).includes("가입만 해도 3일"));
    assert.ok(textOf(TEST_PAGES.tarot).includes("990원") && textOf(TEST_PAGES.tarot).includes("처음 이용하면 3일"));
  });

  test("위기 연락처는 109·1577-0199·112·119를 모두 쓴다(타로 FAQ에 112가 빠졌던 점검 지적 반영)", () => {
    for (const p of TEST_PAGE_LIST) {
      const all = textOf(p);
      for (const n of ["109", "1577-0199", "112", "119"]) assert.ok(all.includes(n), `${p.slug}: ${n}`);
    }
  });

  test("맨 아래 버튼: 타로 테스트 링크는 타로 페이지의 테스트 링크와 같고, 모든 페이지에 쏘웰라 연결 버튼 글자가 있다", () => {
    assert.equal(TAROT_URL, TEST_PAGES.tarot.testUrl);
    assert.equal(TAROT_BUTTON, TEST_PAGES.tarot.testButton);
    assert.equal(TAROT_BUTTON, "타로 테스트 보러 가기");
    for (const p of TEST_PAGE_LIST) assert.ok(p.sowellaButton.includes("쏘웰라"), p.slug);
  });

  test("하단 고지: 기본 문장이 있고, 아스트로는 앞에 '예측 도구가 아니며'가 붙는다", () => {
    const base = "쏠 웰니스 하우스의 서비스는 의학적 진단·치료·처방을 제공하지 않으며, 전문 의료·상담을 대신하지 않습니다.";
    for (const p of TEST_PAGE_LIST) assert.ok(p.disclaimer.includes(base), p.slug);
    assert.ok(TEST_PAGES.astro.disclaimer.startsWith("예측 도구가 아니며"));
  });

  test("한눈에 보기 표·이용 순서·쏘웰라 연결·FAQ가 모두 있다", () => {
    for (const p of TEST_PAGE_LIST) {
      const h2s = p.sections.map((s) => s.h2);
      assert.ok(h2s.includes("한눈에 보기") && h2s.includes("이용 순서") && h2s.includes("만든 사람"), p.slug);
      const blocks: Block[] = p.sections.flatMap((s) => s.blocks);
      assert.ok(blocks.some((b) => b.t === "table"), `${p.slug}: table`);
      assert.ok(blocks.some((b) => b.t === "ol"), `${p.slug}: ol`);
      assert.ok(p.sowella.includes("쏘웰라") && p.sowella.includes("3일") || p.sowella.includes("1주일"), `${p.slug}: 쏘웰라 연결`);
      assert.ok(p.faq.flatMap((g) => g.items).length >= 12, `${p.slug}: FAQ ${p.faq.flatMap((g) => g.items).length}개`);
    }
  });

  test("구조화 데이터: WebApplication + FAQPage, FAQ는 화면의 FAQ와 글자까지 같고 가격·후기·별점이 없다", () => {
    for (const p of TEST_PAGE_LIST) {
      const ld = testPageJsonLd(p);
      const [app, faq] = ld["@graph"] as unknown as [Record<string, unknown>, { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }];
      assert.equal(app["@type"], "WebApplication");
      assert.equal(app.mainEntityOfPage, p.canonical);
      assert.equal(app.url, p.homeUrl);
      const shown = p.faq.flatMap((g) => g.items);
      assert.equal(faq.mainEntity.length, shown.length);
      faq.mainEntity.forEach((e, i) => {
        assert.equal(e.name, shown[i].q);
        assert.equal(e.acceptedAnswer.text, shown[i].a);
      });
      const json = JSON.stringify(ld);
      for (const k of ["offers", "Review", "aggregateRating"]) assert.equal(json.includes(k), false, `${p.slug}: ${k}`);
    }
  });
});
