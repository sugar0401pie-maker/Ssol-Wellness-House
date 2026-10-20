import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_MAP, mapOnboardingAnswers, onboardingEligible, rankedKeys } from "./onboardingInput.ts";

test("순위 답은 순위대로 키만 뽑는다 · 이상한 값은 버린다", () => {
  assert.deepEqual(rankedKeys([{ key: "b", rank: 2 }, { key: "a", rank: 1 }, { key: 3, rank: 3 }, null, { key: "c" }]), ["a", "b"]);
  assert.deepEqual(rankedKeys(null), []);
});

test("우리 코드를 CSO 코드로 바꿔 읽고, 대응 없는 값은 버린다", () => {
  const a = mapOnboardingAnswers({
    values_ranked: [{ key: "career_success", rank: 1 }], relationship_status: "has_partner", relationship_stage: "preparing_marriage_or_cohabitation",
    child_age_groups: ["age_3_6", "adult_child"], daily_time: ["under_5", "flexible"], focus_domains: ["romance"], completed_at: "2026-10-01T00:00:00Z",
  });
  assert.deepEqual(a.values_ranked, { value: ["career_success"], answered_at: "2026-10-01T00:00:00Z" });
  assert.equal(a.relationship_stage.value, "engaged");
  assert.deepEqual(a.child_age_groups.value, ["preschool"]);
  assert.deepEqual(a.daily_time.value, ["under_5"]);
  assert.equal(a.relationship_status.value, "has_partner");
});

test("비어 있거나 매핑 뒤 남는 게 없으면 그 문항은 아예 넣지 않는다(모르는 값은 맞다고 보지 않음)", () => {
  const a = mapOnboardingAnswers({ daily_time: ["flexible", "varies"], dating_interest: "unsure", hobbies_ranked: [], focus_domains: null }, "2026-10-20T00:00:00Z");
  assert.deepEqual(Object.keys(a), []);
});

test("그 외 값은 그대로 통과(우리 화면 코드가 기준)", () => {
  const a = mapOnboardingAnswers({ focus_domains: ["none"], excluded_activities: ["other_people", "none"], primary_activity: "prefer_not" });
  assert.deepEqual(a.focus_domains.value, ["none"]);
  assert.deepEqual(a.excluded_activities.value, ["other_people", "none"]);
  assert.equal(a.primary_activity.value, "prefer_not");
  assert.ok(CODE_MAP.daily_time.min_20_30 === null);
});

test("끝낸 온보딩 + 개인화 동의가 있을 때만 근거로 쓴다", () => {
  assert.equal(onboardingEligible({ status: "completed", personalization_consent: true }), true);
  for (const bad of [null, undefined, { status: "completed", personalization_consent: false }, { status: "in_progress", personalization_consent: true }, { status: "completed" }])
    assert.equal(onboardingEligible(bad as never), false);
});
