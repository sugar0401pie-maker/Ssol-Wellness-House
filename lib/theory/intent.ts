// 사용자가 칩을 누르지 않고 글로 쓴 말에서 "무엇을 원하는지"를 가볍게 알아보는 순수 함수(intent.test.ts).
// 새 AI 호출 없이 키워드로만 판정하고, 애매하면 null(= 특별한 의도 없음)이다 — 목록은 실제 대화 로그를 보며 넓혀 간다.
export type TextIntent = "action" | "explore" | "stop" | null;

// "그냥 방법만 알려줘"처럼 바로 해볼 수 있는 것을 원하는 말 → 행동 제안(문서 D1)
const ACTION_WORDS = ["방법만", "방법 알려", "방법을 알려", "행동 제안", "해결책", "해결 방법", "뭘 하면", "무엇을 하면", "어떻게 하면 돼", "어떻게 하면 되", "바로 해볼", "당장 해볼", "해볼 만한 것", "해볼만한 것"];
// 더 이야기하고 싶다는 말 → 탐색
const EXPLORE_WORDS = ["더 이야기", "더 얘기", "더 들여다", "깊게 알아", "깊이 알아", "고민을 더", "더 알아보고 싶", "더 말하고 싶"];
// 그만하고 싶다는 말 → 탐색·제안을 멈추고 평소 대화로
// ("그만큼 힘들어요", "일을 그만두고 싶어요"처럼 일상 표현에 들어 있는 '그만'에 걸리지 않도록 좁게 잡았다.)
const STOP_WORDS = ["그만 얘기", "그만 이야기", "그만 물어", "그만 말", "이제 그만할래", "그만할래요", "그만하고 싶", "이제 됐어요", "다른 얘기", "다른 이야기", "그 얘기는 싫", "그 이야기는 싫", "말하기 싫", "이야기하기 싫", "얘기하기 싫"];

export function detectTextIntent(message: string): TextIntent {
  const t = message.replace(/\s+/g, " ").trim();
  if (STOP_WORDS.some((w) => t.includes(w))) return "stop";
  if (ACTION_WORDS.some((w) => t.includes(w))) return "action";
  if (EXPLORE_WORDS.some((w) => t.includes(w))) return "explore";
  return null;
}

// 사용자가 이미 "다음 걸음"을 말했는지(문서 4-2 ②-1: 1~2턴에 다음 걸음을 말하면 COMMIT으로 바로 넘어간다).
const NEXT_STEP_WORDS = ["해볼게요", "해볼래요", "해보려고요", "해볼까요", "써볼게요", "써볼까요", "적어볼게요", "시작해볼게요", "시작해볼래요", "그렇게 해볼게", "해보겠습니다", "해보겠어요"];
export function declaresNextStep(message: string): boolean {
  const t = message.replace(/\s+/g, "");
  return NEXT_STEP_WORDS.some((w) => t.includes(w.replace(/\s+/g, "")));
}

// 답이 너무 짧거나 막연해서("몰라요", "그냥요", "네") 질문 하나를 더 해야 하는지(문서 4-2 ②-2의 "충분한가" 판단).
const VAGUE = ["몰라요", "모르겠어요", "그냥요", "글쎄요", "잘 모르", "그냥 그래요", "없어요", "딱히"];
export function isVagueAnswer(message: string): boolean {
  const t = message.replace(/\s+/g, "").trim();
  if (t.length <= 6) return true;
  return VAGUE.some((w) => t.includes(w.replace(/\s+/g, ""))) && t.length <= 16;
}
