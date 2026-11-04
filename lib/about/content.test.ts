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
    assert.equal(C.FAQ.length, 18);
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

  test("근거 없는 성능·정확도 수치(퍼센트)나 효과 보장 표현이 없다", () => {
    assert.equal(/\d+(\.\d+)?\s*%/.test(allText), false);
    assert.equal(/효과를?\s*보장|완치|치료됩니다|확실히\s*나아/.test(allText), false);
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
