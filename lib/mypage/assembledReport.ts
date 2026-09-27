import "server-only";

// 2026-09-25 버그 발견: 심리테스트 앱이 v2로 재구축되면서 ssol_reports의 리포트 본문 컬럼이
// sections(배열, {title,body}[]) → assembled(객체, {section2..section7})로 바뀌었다. assembled를
// 우리 프론트가 아는 {title,body}[] 모양으로 변환한다. 여러 화면(app/api/mypage,
// app/api/mypage/reports/[resultId])이 같은 변환을 쓰므로 여기 한 곳에 모아둔다.
export type AssembledReportV2 = {
  section2: string | string[]; // 2026-09-25: 문단 구분을 위해 string[]로도 옴
  section3: string | null;
  section4: string | string[];
  section5: string | null;
  section6: string[];
  section7: string | null;
};

export const SECTION_TITLES: Record<keyof AssembledReportV2, string> = {
  section2: "주 고민 영역 해부",
  section3: "프로파일 모양",
  section4: "대처 상세",
  section5: "고민과 대처의 궁합",
  section6: "특수 플래그",
  section7: "이번 주 제안",
};

export function assembledToSections(a: AssembledReportV2 | null | undefined): { title: string; body: string }[] {
  if (!a) return [];
  const out: { title: string; body: string }[] = [];
  (Object.keys(SECTION_TITLES) as (keyof AssembledReportV2)[]).forEach((key) => {
    const value = a[key];
    const body = Array.isArray(value) ? value.join(" ") : value;
    if (body) out.push({ title: SECTION_TITLES[key], body });
  });
  return out;
}
