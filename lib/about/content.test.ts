import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as C from "./content.ts";
import { PUBLIC_PATHS } from "../seo/paths.ts";

// 화면에 나가는 모든 글(배열·표 포함)을 한 덩어리로 모은다.
const allText = [
  C.ABOUT_TITLE, C.ABOUT_DESCRIPTION, C.ABOUT_H1, C.ABOUT_INTRO, C.CONCERNS_INTRO, C.FLOW_INTRO, C.SAFETY_INTRO, C.SAFETY_HOTLINE, C.ABOUT_DISCLAIMER,
  ...C.AT_A_GLANCE.flat(), ...C.CONCERNS.flat(), ...C.FLOW_STEPS.flat(), ...C.NOT_DOING, ...C.HOW_TO_USE, ...C.PRICE_ROWS.flat(),
  ...C.FAQ.flatMap((f) => [f.q, f.a]),
].join("\n");

describe("/about 글", () => {
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

  test("근거 없는 성능·정확도 수치(퍼센트)나 효과 보장 표현이 없다", () => {
    assert.equal(/\d+(\.\d+)?\s*%/.test(allText), false);
    assert.equal(/효과를?\s*보장|완치|치료됩니다|확실히\s*나아/.test(allText), false);
  });

  test("요금 표는 실제 결제와 같은 값(pricing.ts)에서 만든다", () => {
    assert.deepEqual(C.PRICE_ROWS.map((r) => r[1]), ["4,500원", "8,700원", "22,800원"]);
  });

  test("/about은 canonical이 메인 페이지라 사이트맵(공개 주소 목록)에 넣지 않는다", () => {
    assert.equal((PUBLIC_PATHS as readonly string[]).includes("/about"), false);
  });
});
