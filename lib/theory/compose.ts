// 탐색 턴의 답변을 "AI가 쓴 짧은 앞부분 + DB에 있는 검수된 질문/실천을 그대로" 이어 붙여 만든다(문서 4-16: DB 우선 응답).
// 순수 함수라 테스트할 수 있다(compose.test.ts). AI는 한두 문장만 쓰고, 질문과 실천 문구는 시스템이 원문 그대로 붙인다.

// AI가 규칙을 어기고 질문을 썼을 때를 대비해, 앞부분에서 물음표로 끝나는 문장을 지운다(질문은 시스템이 하나만 붙인다).
export function stripQuestions(text: string): string {
  const sentences = text.trim().split(/(?<=[.!?？。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return sentences.filter((s) => !/[?？]\s*$/.test(s)).join(" ").trim();
}

export function composeExploreReply(lead: string, question: string): string {
  const head = stripQuestions(lead);
  return head ? `${head}\n\n${question.trim()}` : question.trim();
}

export type CommitPractice = { title: string; reason: string | null };

// 실천은 이름 아래 "왜 권하는지" 한 줄(제안 이유)을 붙인다. 번호 목록은 마크다운이 아니라 "첫째/둘째" 문장으로 쓴다(일반 텍스트 규칙).
export function composeCommitReply(lead: string, practices: CommitPractice[]): string {
  const head = stripQuestions(lead);
  if (!practices.length) return head;
  const ord = ["첫째", "둘째", "셋째"];
  const lines = practices.slice(0, 3).map((p, i) => `${ord[i]}, ${p.title}${p.reason ? `\n${p.reason}` : ""}`);
  return `${head ? head + "\n\n" : ""}지금 이야기에 맞춰 이런 걸 해볼 수 있어요.\n\n${lines.join("\n\n")}`;
}
