import "server-only";

// 2026-09-25 버그 발견: 심리테스트 앱이 v2로 재구축되면서 ssol_reports의 리포트 본문 컬럼이
// sections(배열, {title,body}[]) → assembled(객체, {section2..section7})로 바뀌었다. assembled를
// 우리 프론트가 아는 모양으로 변환한다. 여러 화면(app/api/mypage, app/api/mypage/reports/[resultId])이
// 같은 변환을 쓰므로 여기 한 곳에 모아둔다.
//
// 2026-09-30 재발견: 그 뒤로도 형제 사이트(quiz.ssolwellnesshouse.com)가 리포트를 다시 한 번
// 개편해서(섹션 1·8 추가, 섹션 제목 전면 변경, 문단이 하나의 문자열이 아니라 배열로 옴)
// 이 변환이 완전히 옛날 스키마를 보고 있었다 — section1/section8이 통째로 안 보이고, 나머지도
// 옛날 제목("주 고민 영역 해부" 등)과 한 문장으로 합쳐진 본문을 쓰고 있었다. 형제 사이트의
// lib/reportV3/types.ts(GeneratedSectionsV3)와 lib/reportV3/uiSections.ts를 기준으로 맞췄다.
export type AssembledReportV3 = {
  section1: string[];
  section2: string[];
  section3: string[];
  section4: string[];
  section5: string[];
  section6: string[];
  section7: string[];
  section8: string[];
};

const SECTION_KEYS = ["section1", "section2", "section3", "section4", "section5", "section6", "section7", "section8"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

// quiz 앱의 lib/josa.ts EUL_REUL()와 같은 받침 판정 규칙(한글 음절 유니코드 오프셋 % 28).
function eulReul(word: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 !== 0 ? "을" : "를";
}

/** 3번·5번은 확정 영역 이름이 들어갑니다(quiz 앱과 같은 제목 문구). */
export function sectionTitles(axisKR: string): Record<SectionKey, string> {
  return {
    section1: "당신의 웰니스 프로파일",
    section2: "주목할 만한 부분은",
    section3: `${axisKR}${eulReul(axisKR)} 다루는 나의 방식`,
    section4: "더 자세히 들여다보면",
    section5: `${axisKR}${eulReul(axisKR)} 고민하는 나의 모습`,
    section6: "다른 유형과의 관계성",
    section7: "앞으로 나아갈 방향",
    section8: "바로 지금, 작은 변화를 만들어봐요",
  };
}

export interface ReportSectionData {
  key: SectionKey;
  title: string;
  paragraphs: string[];
}

export function assembledToSections(a: AssembledReportV3 | null | undefined, axisKR: string): ReportSectionData[] {
  if (!a) return [];
  const titles = sectionTitles(axisKR);
  return SECTION_KEYS.map((key) => ({ key, title: titles[key], paragraphs: Array.isArray(a[key]) ? a[key] : [] })).filter(
    (s) => s.paragraphs.length > 0,
  );
}
