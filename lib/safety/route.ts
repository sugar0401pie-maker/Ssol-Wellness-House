import "server-only";
import { getSafetyData } from "./rules.ts";
import { findKeywordHits, instantHit } from "./keywordCheck.ts";
import { classifyMessage, ClassifierUnavailableError } from "./classify.ts";
import { decisionFromInstantHit, decisionOnClassifierFailure, combineWithClassifier } from "./combine.ts";
import type { RouteDecision } from "./types.ts";

export { ClassifierUnavailableError };

/**
 * 사용자 메시지 하나에 대해 안전 route를 정한다.
 *
 * 순서:
 *  1) 키워드 검사 (DB 기반, 네트워크 호출 없음)
 *     - "죽고 싶다/자살/자해" 같은 명백한 표현, "신체적 폭력/협박/스토킹" 같은 명백한 표현이 있으면
 *       분류기를 부르지 않고 즉시 결정한다. → OpenAI가 죽어 있어도 위기 대응은 항상 동작한다.
 *  2) 그 외에는 AI 분류기(gpt-5.6-luna)를 불러 route를 묻는다.
 *  3) 분류기 결과와 키워드 후보 중 "더 위험한 쪽"을 최종 route로 채택한다.
 *  4) 분류기 확신도가 낮으면 한 단계 더 위험한 쪽으로 올린다. (승인된 원칙: 애매하면 안전한 쪽으로)
 *  5) 분류기 호출 자체가 실패하면(네트워크/OpenAI 장애) 답변을 지어내지 않고, 이 사실을
 *     classifierUnavailable=true로 알린다. 호출한 쪽(API 라우트)은 이 경우 생성/검색을 하지 않고
 *     안전한 안내 문구만 보여줘야 한다.
 *
 * 판정을 실제로 합치는 로직은 combine.ts에 순수 함수로 분리해 두어 네트워크 없이 테스트한다.
 */
export async function determineRoute(
  message: string,
  recentMessages: { role: "user" | "assistant"; content: string }[] = [],
): Promise<RouteDecision> {
  const { rules, routes } = await getSafetyData();
  const hits = findKeywordHits(message, rules);

  const strong = instantHit(hits);
  if (strong) return decisionFromInstantHit(strong, hits);

  let classifier;
  try {
    classifier = await classifyMessage(message, recentMessages, rules);
  } catch (e) {
    if (!(e instanceof ClassifierUnavailableError)) throw e;
    return decisionOnClassifierFailure(hits, e.message);
  }

  return combineWithClassifier(hits, classifier, routes);
}
