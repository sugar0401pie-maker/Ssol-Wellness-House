// 대화 목록 화면에 "대략 무슨 내용인지" 보여줄 요약. 별도로 AI를 불러 요약하면 비용이 드니까
// (CLAUDE.md 비용 원칙), 그 세션의 첫 사용자 메시지를 짧게 잘라 chat_sessions.topic_tag에
// 저장해두고 그대로 보여주는 방식을 쓴다 — 대부분의 채팅 앱이 쓰는 방식과 같다.
const MAX_LEN = 40;

export function makeTopicTag(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_LEN) return clean;
  return clean.slice(0, MAX_LEN) + "…";
}
