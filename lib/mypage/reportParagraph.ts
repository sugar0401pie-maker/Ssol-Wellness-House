// 2026-09-30: 형제 사이트(quiz.ssolwellnesshouse.com)의 lib/reportV3/boldParagraph.ts +
// lib/reportV3/uiSections.ts(leadInIndexFor)와 같은 규칙 — 리포트 문단은 마크다운 없이
// 평문으로 오고(quiz 앱 프롬프트 규칙 15), "•"로 시작하는 소제목 줄 전체와 "첫째,"류
// 서수 접두어만 화면에서 굵게 표시한다. 다른 저장소라 import를 공유할 순 없어서 로직만
// 그대로 옮겨왔다(규칙이 바뀌면 양쪽 다 고쳐야 한다).
const ORDINAL_PREFIX = /^(첫째|둘째|셋째|넷째|다섯째),/;
const BULLET_LINE = /^•/;

export interface BoldSplit {
  boldText: string;
  restText: string;
}

export function splitBoldParagraph(text: string, forceBold = false): BoldSplit {
  if (forceBold || BULLET_LINE.test(text)) return { boldText: text, restText: "" };
  const m = text.match(ORDINAL_PREFIX);
  if (m) return { boldText: m[0], restText: text.slice(m[0].length) };
  return { boldText: "", restText: text };
}

const SECTION6_ADVICE_HEADING = "• 나와 다른 사람과 잘 지내는 법";

/** 2·3·4·5·7·8번은 첫 문단이 두괄식 요약(규칙 17), 6번은 조언 소제목 바로 다음 문단, 1번은 없음. */
export function leadInIndexFor(sectionKey: string, paragraphs: string[]): number | null {
  if (sectionKey === "section1") return null;
  if (sectionKey === "section6") {
    const idx = paragraphs.findIndex((p) => p.trim() === SECTION6_ADVICE_HEADING);
    return idx >= 0 && idx + 1 < paragraphs.length ? idx + 1 : null;
  }
  return paragraphs.length > 0 ? 0 : null;
}
