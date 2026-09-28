// 2026-09-28 owner 피드백: 결과보고서 본문이 문장 구분 없이 한 덩어리로 길게 와서 읽기
// 불편했다 — 문장 단위로 쪼갠 뒤 몇 문장씩 묶어 문단으로 나눈다(문단 사이는 빈 줄로 렌더링).
// 순수 함수라 별도 로직 변경 없이 테스트 가능하게 분리한다.
export function splitSentences(text: string): string[] {
  // 마침표/물음표/느낌표 뒤에 공백이 오는 지점에서 자른다 — 한국어 보고서 문장이 대부분
  // "-습니다.", "-해요.", "-까요?" 처럼 끝나므로 이 정도로 충분히 잘 갈린다.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function groupIntoParagraphs(text: string, sentencesPerParagraph = 3): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(" "));
  }
  return paragraphs;
}
