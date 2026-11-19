// checkOutput의 순수 함수 로직 테스트. 실행: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkOutput } from "./outputCheck.ts";

describe("checkOutput", () => {
  test("임상 chunk를 썼는데 전문가 상담 안내가 없으면 위반으로 잡는다", () => {
    const result = checkOutput("그런 마음이 드셨군요. 오늘 하루 어떠셨는지 더 들려주세요.", {
      usedClinicalChunk: true,
    });
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("전문가 상담")));
  });

  test("임상 chunk를 썼어도 이번 세션에서 이미 안내했다면(clinicalBoundaryAlreadyStated) 반복을 요구하지 않는다", () => {
    // 2026-09-22 결정: "진단을 대신할 수 없어요" 문구가 매 턴 반복된다는 실사용 피드백 반영.
    const result = checkOutput("오늘은 잠깐 산책을 해보시거나, 좋아하는 음악을 들어보는 것도 도움이 될 수 있어요.", {
      usedClinicalChunk: true,
      clinicalBoundaryAlreadyStated: true,
    });
    assert.equal(result.ok, true);
  });

  test("clinicalBoundaryAlreadyStated여도 진단처럼 들리는 표현이나 약물 지시는 여전히 잡는다", () => {
    const result = checkOutput("항우울제를 지금 중단하세요.", {
      usedClinicalChunk: true,
      clinicalBoundaryAlreadyStated: true,
    });
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("약물")));
  });
});

test("한자·일본 문자가 섞인 답은 다시 쓰게 한다(2026-11-19) — 한글·영문·숫자·문장부호는 그대로", async () => {
  const { FOREIGN_SCRIPT_PREFIX, stripForeignScript } = await import("./outputCheck.ts");
  const bad = checkOutput("忙한 가운데서도 원하는 걸 찾아볼 수 있어요.", { usedClinicalChunk: false });
  assert.equal(bad.ok, false);
  assert.ok(bad.violations.some((v) => v.startsWith(FOREIGN_SCRIPT_PREFIX) && v.includes("忙")));
  assert.equal(checkOutput("ありがとう", { usedClinicalChunk: false }).ok, false);
  assert.equal(checkOutput("오늘 3분만 OK, 천천히 해 봐요! (메모 앱)", { usedClinicalChunk: false }).ok, true);
  assert.equal(stripForeignScript("忙한 가운데서도"), "한 가운데서도");
});
