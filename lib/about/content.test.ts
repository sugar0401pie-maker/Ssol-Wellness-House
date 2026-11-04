import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as C from "./content.ts";
import { PUBLIC_PATHS } from "../seo/paths.ts";

// content.ts가 내보내는 모든 글(문자열·배열·표·사람 소개 포함)을 한 덩어리로 모은다 — 나중에 항목이 늘어도 자동으로 검사 대상에 들어온다.
function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
  return out;
}
const exportedTexts = Object.entries(C)
  .filter(([, v]) => typeof v !== "function")
  .flatMap(([, v]) => collect(v));
const allText = exportedTexts.join("\n");

describe("/about 글", () => {
  test("글이 충분히 모였다(전체 섹션이 들어 있다)", () => {
    assert.ok(exportedTexts.length > 200, `문구 ${exportedTexts.length}개`);
    assert.ok(allText.includes("109(24시간)"));
    assert.ok(allText.includes("설명을 위해 만든 가상의 사례예요. 실제 이용자 후기가 아니에요."));
    assert.ok(allText.includes("실제 사용자의 사례를 쏘웰라의 안전 기준에 맞춰 각색한 대화 예시예요."));
    assert.equal(C.MAKERS.length, 4);
    assert.equal(C.FAQ.length, 20);
  });

  test("기획 초안의 출처 표기·검토 표시가 화면 글에 남아 있지 않다", () => {
    for (const mark of ["(IR", "IR ", "⚠️", "⏸", "✅", "CONFIDENTIAL"]) {
      assert.equal(allText.includes(mark), false, `${mark} 가 들어 있음`);
    }
  });

  test("FAQ 구조화 데이터는 화면의 FAQ와 글자까지 같다", () => {
    const ld = C.faqJsonLd();
    assert.equal(ld.mainEntity.length, C.FAQ.length);
    ld.mainEntity.forEach((e, i) => {
      assert.equal(e.name, C.FAQ[i].q);
      assert.equal(e.acceptedAnswer.text, C.FAQ[i].a);
    });
  });

  test("퍼센트·건수 수치가 있는 글에는 '자체 내부 평가'와 '실제 결과는 다를 수 있음'이 반드시 같이 있다", () => {
    // 2026-11-04: 대표님 지시로 품질 점검 수치(97.4%·98.3%·97.0%·0/44)를 게시한다. 기획 문서의 조건(자체 내부 평가라는 말과 측정 조건을 같이 적기)은 유지한다.
    const withNumbers = [C.QUALITY_INTRO, C.QUALITY_NOTE, ...C.QUALITY_ROWS.flat(), ...C.FAQ.filter((f) => /\d+(\.\d+)?\s*%|0\/44|44건/.test(f.a)).map((f) => f.a)];
    assert.ok(C.FAQ.filter((f) => /97\.4%|44건/.test(f.a)).length === 2, "수치가 있는 FAQ 2개");
    assert.match(C.QUALITY_INTRO, /자체 내부 평가/);
    assert.match(C.QUALITY_INTRO, /외부 기관의 인증이나 임상 효과를 뜻하지 않아요/);
    assert.match(C.QUALITY_INTRO, /실제 이용 결과는 다를 수 있어요/);
    for (const f of C.FAQ.filter((f) => /\d+(\.\d+)?\s*%|44건/.test(f.a))) {
      assert.match(f.a, /자체 내부 평가/, f.q);
      assert.match(f.a, /다를 수 있어요|완벽히 걸러낼 수는 없어요/, f.q);
    }
    // 수치가 본문 다른 곳에 새어 나가지 않는다: 퍼센트는 품질 점검 표·소개 글·FAQ 2개에만 있다
    const outside = allText.split("\n").filter((l) => /\d+(\.\d+)?\s*%/.test(l) && !withNumbers.includes(l));
    assert.deepEqual(outside, []);
  });

  test("효과 보장·치료 단정 표현이 없다", () => {
    assert.equal(/효과를?\s*보장|완치|치료됩니다|확실히\s*나아/.test(allText), false);
  });

  test("개인정보 보호 글은 약관 예고문과 같은 보관 기간(24개월 파기·통계 최대 3년)을 말한다", () => {
    const privacy = C.PRIVACY_POINTS.join("\n");
    assert.match(privacy, /24개월/);
    assert.match(privacy, /최대 3년/);
    assert.match(privacy, /OpenAI\(미국\)/); // 상담 원문이 외부 AI로 가지 않는 것처럼 읽히지 않게 국외 이전도 밝힌다
    assert.doesNotMatch(privacy, /입력 단계에서 마스킹/); // 대화 원문은 마스킹하지 않는다(약관 예고문 1항)
  });

  test("고민 영역 설명: 5개 영역이 모두 있고, 메인 페이지의 예시 문장 7개가 그대로 들어 있다", () => {
    assert.deepEqual(C.CONCERN_AREAS.map((a) => a.area), ["커리어", "연애", "관계", "나 자신", "삶의 방향"]);
    const quotes = C.CONCERN_AREAS.flatMap((a) => a.quotes).join("\n");
    for (const q of [
      "지금 다니는 회사, 옮길까 그냥 다닐까?",
      "왜 계속 이상한 사람만 만나는 거야?",
      "팀장님이 나만 싫어하는 걸까?",
      "내가 진정으로 원하는 건 뭐지?",
      "뭘 위해 모으는 거지?",
      "부모님 노후, 결국 내 몫일까?",
      "다들 잘 사는데, 나만 제자리인 것 같아",
    ]) {
      assert.ok(quotes.includes(q), q);
    }
    // 영역마다 설명이 있고, 주 이론은 메인 페이지 "대표 상담 이론"과 같다
    const theory: Record<string, string> = { 커리어: "CBT", 연애: "EFT", 관계: "스키마치료", "나 자신": "웰빙치료", "삶의 방향": "ACT" };
    for (const a of C.CONCERN_AREAS) {
      assert.ok(a.help.length > 40, a.area);
      assert.ok(a.help.includes(theory[a.area]), `${a.area}의 주 이론 ${theory[a.area]}`);
    }
    // 근거 없이 지어 쓴 단계 예시가 없다: 예시가 있는 영역은 메인 페이지 "단계별 제안" 표의 단계와 같아야 한다
    const known = C.STEP_ROWS.map((r) => r[1]);
    for (const a of C.CONCERN_AREAS.filter((a) => a.example)) {
      assert.ok(known.includes(a.example!), `${a.area}의 예시가 단계별 제안 표에 없음`);
    }
  });

  test("요금은 실제 결제와 같은 값(pricing.ts)에서 만든다", () => {
    assert.deepEqual(C.PRICE_ROWS.map((r) => r[1]), ["4,500원", "8,700원", "22,800원"]);
    const priceFaq = C.FAQ.find((f) => f.q.includes("요금"))!;
    assert.ok(priceFaq.a.includes("4,500원") && priceFaq.a.includes("8,700원") && priceFaq.a.includes("22,800원"));
  });

  test("/about은 canonical이 메인 사이트라 사이트맵(공개 주소 목록)에 넣지 않는다", () => {
    assert.equal((PUBLIC_PATHS as readonly string[]).includes("/about"), false);
  });
});
