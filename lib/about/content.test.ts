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
    assert.equal(C.FAQ.length, 18); // 메인 about.html과 같은 18개
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

  test("메인에 없는 품질 점검 수치(97.4% 등)·44개 점검 문구가 본문에 없다", () => {
    // 2026-11-15: 앱 /about을 메인과 똑같이 맞춰 품질 점검·개인정보 섹션을 뺐다(메인에는 싣지 않기로 한 내용 — 기획 v1.1).
    assert.equal(/\d+(\.\d+)?\s*%/.test(allText), false);
    assert.equal(/0\/44|44개|자체 내부 평가/.test(allText), false);
  });

  test("쏘웰라 이용권 기간은 디저트 7일·타로 아스트로 3일로 구분해 쓴다(메인 사이트 최신)", () => {
    assert.ok(C.HOW_TO_USE.some((s) => s.includes("디저트 테스트 심층 보고서") && s.includes("7일") && s.includes("타로·아스트로 리포트는 3일")));
    const free = C.FAQ.find((f) => f.q.includes("무료로 써볼 수 있나요"))!;
    assert.ok(free.a.includes("디저트 테스트의 심층 보고서") && free.a.includes("타로·아스트로 리포트는 3일 이용권"));
  });

  test("효과 보장·치료 단정 표현이 없다", () => {
    assert.equal(/효과를?\s*보장|완치|치료됩니다|확실히\s*나아/.test(allText), false);
  });

  test("고민 예시: 메인 페이지의 예시 문장 23개가 그대로 들어 있고, 화면에는 7개를 보여준다", () => {
    assert.equal(C.CONCERN_SHOWN, 7);
    assert.deepEqual(C.CONCERN_EXAMPLES, [
      ["별자리", "나 디테일에 집착하는데 이거 설마 처녀자리라서 그런 거야?"],
      ["MBTI", "MBTI는 I인데 사람 만나는 게 좋아, 사실 난 E인 걸까?"],
      ["관계", "나 T라서 조심해서 말하는데 사람들이 자꾸 상처받는 것 같아"],
      ["연애", "썸 타는 사람이 카톡 답장을 3시간째 안 해, 기다려 말아?"],
      ["일상", "주말에 누워서 폰만 보다가 일요일 밤에 허무해"],
      ["커리어", "회사 옮길까 그냥 다닐까, 오늘도 생각만 하다 퇴근했어"],
      ["관계", "단톡방에서 내 말에만 답장이 늦는 것 같아서 서운해"],
      ["돈", "이번 달도 통장이 텅 비었어, 소비 습관 어떡하지"],
      ["자기계발", "퇴근하고 뭐라도 배워야 할 것 같은데 뭘 해야 할지 모르겠어"],
      ["취향", "타로도 믿고 사주도 믿는데 이런 얘기 어디 가서 하지?"],
      ["연애", "이거 썸 맞아? 친구들 말고 누구한테 물어보지?"],
      ["관계", "친구 생일 선물, 이 정도면 너무 성의 없어 보일까?"],
      ["별자리", "별자리 풀이가 너무 나 같은데, 이 얘기 들어줄 사람?"],
      ["일상", "요즘 뭘 먹어도 그냥 그래, 입맛도 슬럼프가 있나?"],
      ["커리어", "나 내년에 역마살 대박이라는데, 어디로 이직하면 될까?"],
      ["관계", "거절을 못 해서 약속이 자꾸 늘어나"],
      ["일", "월요일 생각하면 일요일 저녁부터 기분이 가라앉아"],
      ["일", "회의에서 한마디도 못 하고 나왔어, 나만 이래?"],
      ["자기계발", "작심삼일만 백 번째, 나 의지가 약한 걸까?"],
      ["연애", "연애 안 한 지 오래됐는데, 조급해해야 하나?"],
      ["관계", "엄마 잔소리에 또 욱했어, 나 왜 이러지"],
      ["MBTI", "나 J인데 계획이 틀어지면 하루를 다 망친 기분이야"],
      ["일상", "집에 오면 아무것도 하기 싫어서 씻는 것도 미뤄"],
    ]);
  });

  test("대화 예시는 쏘웰라가 먼저 말하고 이용자가 답한다(메인과 같은 순서)", () => {
    assert.deepEqual(C.EXAMPLE_DIALOGUE.map(([who]) => who), ["쏘웰라", "이용자"]);
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
