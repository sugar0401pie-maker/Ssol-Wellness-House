// 이 기능의 켜짐 여부와 동작 설정. 기본은 꺼짐 — THEORY_OFFER_ENABLED=true일 때만 동작한다.
// env를 인자로 받는 순수 함수라 테스트에서 값을 바꿔 확인할 수 있다.
export type TheoryConfig = {
  enabled: boolean;
  // 칩을 안 누르고 말을 이어가면 탐색으로 간주할지(문서 D1, 기본 켜짐). THEORY_IMPLICIT_EXPLORE=false로 끌 수 있다.
  implicitExplore: boolean;
};

export function getTheoryConfig(env: Record<string, string | undefined> = process.env): TheoryConfig {
  return {
    enabled: env.THEORY_OFFER_ENABLED === "true",
    implicitExplore: env.THEORY_IMPLICIT_EXPLORE !== "false",
  };
}
