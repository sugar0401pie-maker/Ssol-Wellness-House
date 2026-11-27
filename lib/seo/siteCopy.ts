import { SITE_URL } from "./paths.ts";
import { ABOUT_INTRO, AT_A_GLANCE } from "../about/content.ts";

// 검색 결과(네이버 등)와 링크 미리보기에 보이는 제목·설명. 문구는 모두 대표님이 정한 것이다(바꿀 때도 대표님 확인).
// 2026-10-21 대표님이 직접 정한 소개 문구로 바꿈(이전 설명에는 "의료서비스가 아니며 진단·치료를 대신하지 않습니다"가 들어 있었다 — 서비스 안의 안내·약관에는 그대로 있다).
// 2026-11-04 · 2026-11-16 대표님이 다시 정함. 링크 공유 미리보기(og)는 검색용과 문구가 달라서 따로 둔다.
// 2026-11-21 대표님이 검색용 제목·설명을 다시 정함(타로 사이트 검색 문구 개편과 같은 방향 — "AI 심리상담" 대신 "나만의 비밀친구": 일상 고민을 나누는 채팅이라서).
// og 문구는 이번에 바꾸지 않았다. 검색 결과 반영은 검색엔진이 다시 읽어 가야 해서 며칠 걸린다.
export const SITE_TITLE = "쏘웰라 AI | 심리상담 전문가가 설계한 나만의 비밀친구, 가입하면 3일 무료";
export const SITE_DESCRIPTION =
  "이유 없이 지칠 때, 전남친과 재회하고 싶을 때, 무턱대고 회사 그만두고 싶을 때에도 언제든지 쏘웰라 AI에게 먼저 털어놓아 보세요. 상담심리 전문가가 설계·검수한 AI 상담이 고민의 원인을 함께 좁히고 이번 주 실천까지 정리해 줘요. 가입하면 3일 무료.";
// 2026-11-27 대표님: 링크 미리보기 제목이 아직 예전("내 손안의 상담사…")으로 뜬다 — 검색 제목(2026-11-21 대표님이 정한 것)과 같게.
export const OG_TITLE = SITE_TITLE;
export const OG_DESCRIPTION = "털어놓기 어려운 고민, 쏘웰라에게 먼저 이야기해 보세요. 가입하면 3일 무료. 전문 심리상담사가 설계한 AI 상담이 원인을 함께 좁히고 이번 주 실천까지 정리해 줘요.";

// 홈("/")은 로그인 확인이 끝나야 화면이 그려져서, 서버 HTML에는 "불러오고 있어요"뿐이다. 자바스크립트를 실행하지 않는 크롤러(네이버·AI 검색 등)가
// 설명문의 근거를 페이지 안에서 찾을 수 있게, 자바스크립트가 꺼진 환경에서만 보이는 소개 글을 둔다(일반 사용자 화면은 그대로).
// 새 문구를 만들지 않고 /about에 이미 있는 소개·"만든 사람" 문장을 그대로 쓴다.
const MADE_BY = AT_A_GLANCE.find(([k]) => k === "만든 사람")?.[1] ?? "";
export const HOME_CRAWLER_INTRO: string[] = [ABOUT_INTRO, `${MADE_BY}해요.`];

// 홈 구조화 데이터(JSON-LD). 날짜·가격은 넣지 않는다 — 화면 문구와 어긋날 일을 만들지 않으려는 것(타로 요청문과 같은 기준).
// 운영사(@id)는 메인 사이트가 정의한 것과 같은 id를 써서 같은 회사로 묶이게 한다.
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: "쏘웰라 AI",
    alternateName: ["쏘웰라", "Ssowella"],
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    inLanguage: "ko-KR",
    publisher: { "@type": "Organization", "@id": "https://www.ssolwellnesshouse.com/#org", name: "쏠 웰니스 하우스", url: "https://www.ssolwellnesshouse.com" },
  };
}
