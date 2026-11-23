// AI 사용량 기록(ai_usage_log) 한 줄을 만드는 순수 함수. 2026-11-23 대표님 요청("토큰 수 DB에 기록").
// 대화 내용·개인정보는 넣지 않는다 — 누가(user_id)·어느 대화(session_id)·어떤 기능·모델·토큰 수만. 사용자별 월 비용 한도(3,000원) 확인용.
// "server-only"를 넣지 않는다(테스트가 바로 읽는다).

export type UsageScope = { route: string; userId?: string | null; sessionId?: string | null };
// cachedInputTokens(2026-11-23): 입력 중 OpenAI가 앞부분을 기억해 싸게 계산한 토큰 수(입력 토큰에 포함됨 · 없으면 0).
export type UsageEvent = { feature: string; model: string; inputTokens: number; outputTokens: number; cachedInputTokens?: number };

export type UsageRow = {
  user_id: string | null;
  session_id: string | null;
  route: string;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokens = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
const label = (s: unknown, fallback: string) => (typeof s === "string" && s.trim() ? s.trim().slice(0, 60) : fallback);

// 요청 밖(관리자 스크립트·캐시 만들기 등)에서 부르면 scope가 없다 — 그때는 route "background", 사용자 없음.
export function usageRow(scope: UsageScope | undefined, e: UsageEvent): UsageRow {
  return {
    user_id: scope?.userId && UUID.test(scope.userId) ? scope.userId : null,
    session_id: scope?.sessionId && UUID.test(scope.sessionId) ? scope.sessionId : null,
    route: label(scope?.route, "background"),
    feature: label(e.feature, "unknown"),
    model: label(e.model, "unknown"),
    input_tokens: tokens(e.inputTokens),
    output_tokens: tokens(e.outputTokens),
    cached_input_tokens: Math.min(tokens(e.cachedInputTokens), tokens(e.inputTokens)), // 입력보다 클 수 없다
  };
}
