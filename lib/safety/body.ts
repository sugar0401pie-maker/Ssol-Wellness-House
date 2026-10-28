// 몸 단계 신호(CSO 제1장 ③-10, 신호 B-a~c) — 2026-10-28.
// 위기·응급 규칙이 아니다. 잠이 며칠 넘게 흔들리거나 몸이 계속 안 좋다고 "본인이 말했을 때" 실천 제안의 속도만 낮춘다(엔진 pacingFilter:
// '가볍게 시작' 단계만 남기고 불편 머무르기 실천은 뺀다). 진단하지 않고, 단어 하나로 정하지 않는다 — 지속 표현과 몸 상태 표현이 함께 있어야 한다.
// 틀려도(놓쳐도) 예전과 같을 뿐이고, 잘못 잡아도 제안이 더 가벼워질 뿐이라 안전한 쪽으로만 틀린다. 이 판정은 저장하지 않는다(그 턴의 제안에만 쓴다).
// 문구는 상담사 검토 전 초안이다. 놓친 표현은 로그를 보며 이 파일에 더한다.

export type BodyKind = "B-a" | "B-b" | "B-c";

// 지속: "요즘 계속", "며칠째", "몇 주째" 등. 중요한 일 앞 하루 이틀은 흔하니 지속 표현이 없으면 세지 않는다(B-a).
const DURATION = /(계속|며칠째|며칠 넘게|몇 주째|몇 주 넘게|몇 달째|매일|매번|밤마다|연일|내내|한 달째|요즘)/;
const SLEEP = /(잠을?\s?(못|설|안)|잠이\s?(안|잘\s?안)|못\s?자|못\s?잤|못\s?자요|(새벽|밤)[^.!?]{0,8}깨|자주\s?깨|자다\s?깨|뒤척|불면)/;
const PAIN = /(아파|아프|두통|통증|몸살|몸이\s?안\s?좋|건강이\s?(많이\s?)?(나빠|안\s?좋|상했))/;
const PAIN_LONG = /(몇 주째|몇 주 넘게|몇 달째|한 달째|오래|안\s?떨어|낫지\s?않|계속)/;
// B-c: 쉬어도 몸이 안 풀리거나 몸이 따라 주지 않는 상태가 이어짐
const TIRED_BODY = /(몸이\s?(안\s?풀|안\s?따라|말을\s?안|무거워서\s?못)|몸이\s?안\s?움직|(누워|쉬어|자고\s?나도|자도)[^.!?]{0,15}(피로|몸)[^.!?]{0,8}(안\s?풀|안\s?가시|그대로|회복\s?(이\s?)?안))/;

export function bodySignals(text: string): BodyKind[] {
  const t = (text ?? "").replace(/\s+/g, " ");
  const out: BodyKind[] = [];
  if (DURATION.test(t) && SLEEP.test(t)) out.push("B-a");
  if (PAIN.test(t) && PAIN_LONG.test(t)) out.push("B-b");
  if (TIRED_BODY.test(t)) out.push("B-c");
  return out;
}

/** 이 대화의 최근 사용자 말(현재 포함) 중 하나라도 몸 단계 신호가 있으면 true. lib/safety가 엔진의 ctx.safetyBody로 넘긴다. */
export const hasBodyStage = (userTexts: string[]): boolean => userTexts.some((t) => bodySignals(t).length > 0);
