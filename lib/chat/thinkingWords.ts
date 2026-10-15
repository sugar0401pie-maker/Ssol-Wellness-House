// 채팅에서 답변을 기다리는 동안 보여주는 "생각하는 중" 문구를 3초마다 돌아가며 바꾼다(2026-10-15 owner 요청: "생각중이라는 말도
// 깜빡이면서 움직이고, 대체할 수 있는 단어도 3초 간격으로 돌아가면서 나오면 좋겠다 — 제안해줘").
// 문구는 Claude 제안이고 owner가 바꿀 수 있다 — 이 배열만 고치면 된다(순서대로 돈다, 첫 번째가 처음에 보인다).
// 규칙: 상담·진단을 암시하지 않고, 일반 글자만 쓰고, "~하는 중" 꼴로 길이를 비슷하게 맞춘다(말풍선 크기가 크게 출렁이지 않게).
export const THINKING_WORDS: readonly string[] = [
  "생각하는 중",
  "이야기를 가만히 듣는 중",
  "마음을 헤아려 보는 중",
  "알맞은 말을 고르는 중",
  "차분히 정리하는 중",
  "함께 들여다보는 중",
];

export const THINKING_INTERVAL_MS = 3000;

// tick(0부터 1씩 늘어나는 번호)에 해당하는 문구. 끝에 닿으면 처음으로 돌아간다.
export function thinkingWordAt(tick: number): string {
  const n = THINKING_WORDS.length;
  const i = ((Math.floor(tick) % n) + n) % n;
  return THINKING_WORDS[i];
}
