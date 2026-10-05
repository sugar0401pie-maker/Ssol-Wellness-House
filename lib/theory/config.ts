import { DEFAULT_MATCHER_CONFIG, type MatcherConfig } from "./matcher.ts";

// 이 기능의 켜짐 여부와 매칭 기준값. 기본은 꺼짐 — THEORY_OFFER_ENABLED=true일 때만 동작한다.
// env를 인자로 받는 순수 함수라 테스트에서 값을 바꿔 확인할 수 있다.
export type TheoryConfig = { enabled: boolean; matcher: MatcherConfig };

function num(v: string | undefined, fallback: number): number {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getTheoryConfig(env: Record<string, string | undefined> = process.env): TheoryConfig {
  return {
    enabled: env.THEORY_OFFER_ENABLED === "true",
    matcher: {
      minScore: num(env.THEORY_MATCH_MIN_SCORE, DEFAULT_MATCHER_CONFIG.minScore),
      margin: num(env.THEORY_MATCH_MARGIN, DEFAULT_MATCHER_CONFIG.margin),
      minHits: num(env.THEORY_MATCH_MIN_HITS, DEFAULT_MATCHER_CONFIG.minHits),
      topPerTheory: DEFAULT_MATCHER_CONFIG.topPerTheory,
    },
  };
}
