import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { passesHardFilter, scoreSoftPreference, emptyPrefs, isApprovedForServing, type PracticeEligibility } from "./practiceFilter.ts";

function eligibility(overrides: Partial<PracticeEligibility> = {}): PracticeEligibility {
  return {
    practiceId: "TEST-1",
    audienceMode: "SELF",
    requiresPartner: false,
    requiresChildcare: false,
    requiresWork: false,
    requiresOtherPerson: false,
    workContext: "none",
    q4ValueCodes: [],
    q5HobbyCodes: [],
    q6WeekendCodes: [],
    q7FocusCodes: [],
    q9ExclusionCodes: [],
    reviewStatus: "DRAFT_HUMAN_APPROVAL_REQUIRED",
    ...overrides,
  };
}

describe("passesHardFilter (SSOL_375_Practice_Onboarding_Project_v1.md §7 QA)", () => {
  test("Q1 no_partner + Q4 find_love 1순위여도 requires_partner 항목은 차단된다", () => {
    const e = eligibility({ requiresPartner: true });
    const prefs = { ...emptyPrefs(), relationshipStatus: "no_partner", valuesRanked: [{ key: "find_love", rank: 1 }] };
    assert.equal(passesHardFilter(e, prefs), false);
  });

  test("Q2 planning + Q7 parenting_care여도 requires_childcare 항목은 차단된다(포커스가 자격을 만들지 않음)", () => {
    const e = eligibility({ requiresChildcare: true });
    const prefs = { ...emptyPrefs(), childcareStatus: "planning", focusDomains: ["parenting_care"] };
    assert.equal(passesHardFilter(e, prefs), false);
  });

  test("Q1 has_partner + Q9 couple 제외 시 requires_partner 항목이 차단된다", () => {
    const e = eligibility({ requiresPartner: true, q9ExclusionCodes: ["couple"] });
    const prefs = { ...emptyPrefs(), relationshipStatus: "has_partner", excludedActivities: ["couple"] };
    assert.equal(passesHardFilter(e, prefs), false);
  });

  test("Q3 student면 requires_work 항목이 차단되고, 관심사(Q7 work_career)는 자격을 안 만든다", () => {
    const e = eligibility({ requiresWork: true });
    const prefs = { ...emptyPrefs(), primaryActivity: "student", focusDomains: ["work_career"] };
    assert.equal(passesHardFilter(e, prefs), false);
  });

  test("Q5 solo_running 1순위여도 Q9 exercise 제외가 우선한다", () => {
    const e = eligibility({ q9ExclusionCodes: ["exercise"] });
    const prefs = { ...emptyPrefs(), hobbiesRanked: [{ key: "solo_running", rank: 1 }], excludedActivities: ["exercise"] };
    assert.equal(passesHardFilter(e, prefs), false);
  });

  test("NEEDS_TITLE_AND_HUMAN_REVIEW 항목은 조건과 무관하게 항상 제외된다", () => {
    const e = eligibility({ reviewStatus: "NEEDS_TITLE_AND_HUMAN_REVIEW" });
    assert.equal(isApprovedForServing(e), false);
    assert.equal(passesHardFilter(e, emptyPrefs()), false);
  });

  test("조건이 하나도 안 걸리면(일반 SELF 실천) 통과한다", () => {
    const e = eligibility();
    assert.equal(passesHardFilter(e, emptyPrefs()), true);
  });

  test("has_partner + 파트너 필요 항목은 정상적으로 통과한다", () => {
    const e = eligibility({ requiresPartner: true });
    const prefs = { ...emptyPrefs(), relationshipStatus: "has_partner" };
    assert.equal(passesHardFilter(e, prefs), true);
  });
});

describe("emptyPrefs (onboarding 안 했거나 개인화 동의 안 한 사용자, 2026-09-25 owner 요청)", () => {
  test("파트너/육아/업무 전제 항목은 emptyPrefs로는 통과하지 못한다 — '확인 안 되면 일반 제안만'", () => {
    assert.equal(passesHardFilter(eligibility({ requiresPartner: true }), emptyPrefs()), false);
    assert.equal(passesHardFilter(eligibility({ requiresChildcare: true }), emptyPrefs()), false);
    assert.equal(passesHardFilter(eligibility({ requiresWork: true }), emptyPrefs()), false);
  });

  test("아무 조건도 없는 일반(SELF류) 항목은 emptyPrefs로도 통과한다", () => {
    assert.equal(passesHardFilter(eligibility(), emptyPrefs()), true);
  });
});

describe("scoreSoftPreference", () => {
  test("1·2·3순위가 각각 3·2·1점으로 반영된다", () => {
    const e = eligibility({ q4ValueCodes: ["career_success"] });
    const prefs = {
      ...emptyPrefs(),
      valuesRanked: [
        { key: "learning_growth", rank: 1 },
        { key: "career_success", rank: 2 },
      ],
    };
    assert.equal(scoreSoftPreference(e, prefs), 2);
  });

  test("Q7 포커스 영역이 겹치면 1점 추가된다", () => {
    const e = eligibility({ q7FocusCodes: ["joy", "self_emotions"] });
    const prefs = { ...emptyPrefs(), focusDomains: ["joy"] };
    assert.equal(scoreSoftPreference(e, prefs), 1);
  });

  test("아무것도 안 겹치면 0점이다", () => {
    const e = eligibility({ q4ValueCodes: ["career_success"] });
    assert.equal(scoreSoftPreference(e, emptyPrefs()), 0);
  });
});
