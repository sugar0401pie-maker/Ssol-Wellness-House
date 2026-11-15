// 소개 페이지(/about, /about/dessert · astro · tarot)가 같이 쓰는 링크 목록. 주소를 한 곳에 모아 두면 메인 사이트 페이지 주소가 바뀔 때 여기만 고치면 된다.
// 크롤러(검색·AI)가 따라갈 수 있게 모두 실제 링크(<a href>)로 건다. 메인 사이트 주소에는 추적용 꼬리표(utm)를 붙이지 않는다 — 대표 주소(canonical)가 갈라져 보이지 않게 하려는 것이다.
import { TEST_PAGE_LIST } from "./testPages.ts";
export { TAROT_CARDS_URL } from "./testPages.ts";

export const MAIN_SITE = "https://www.ssolwellnesshouse.com";

// 메인 사이트(www)의 안내 페이지들 — 제목은 각 페이지의 실제 <title>에서 줄여 썼다(2026-11-15 확인).
export const MAIN_LINKS = {
  about: { label: "쏘웰라 자세한 소개", href: `${MAIN_SITE}/about.html` },
  faq: { label: "쏘웰라·웰니스 테스트·1:1 세션 자주 묻는 질문 모음", href: `${MAIN_SITE}/faq.html` },
  safety: { label: "쏘웰라 안전 장치와 품질 점검", href: `${MAIN_SITE}/safety.html` },
  team: { label: "쏠 웰니스 하우스를 만드는 사람들", href: `${MAIN_SITE}/team.html` },
  session: { label: "1:1 웰니스 세션 안내", href: `${MAIN_SITE}/session.html` },
  privacyGuide: { label: "쏘웰라 대화 내용과 개인정보 보호", href: `${MAIN_SITE}/privacy-guide.html` },
} as const;

export const LEGAL_LINKS = [
  { label: "이용약관", href: "/legal#terms" },
  { label: "개인정보처리방침", href: "/legal#privacy" },
  { label: "민감정보 처리방침", href: "/legal#sensitive" },
] as const;

export type LinkItem = { label: string; href: string };
export type LinkGroup = { title: string; items: LinkItem[] };
export type PageKey = "about" | "dessert" | "astro" | "tarot";

// "더 알아보기" 블록에 들어갈 링크 묶음. 지금 보는 페이지 자신은 뺀다.
export function moreLinkGroups(current: PageKey): LinkGroup[] {
  const appPages: LinkItem[] = [
    ...(current === "about" ? [] : [{ label: "쏘웰라 소개", href: "/about" }]),
    ...TEST_PAGE_LIST.filter((p) => p.slug !== current).map((p) => ({ label: `${p.name} 소개`, href: `/about/${p.slug}` })),
  ];
  const original = TEST_PAGE_LIST.find((p) => p.slug === current);
  const groups: LinkGroup[] = [{ title: "쏘웰라와 테스트 소개", items: appPages }];
  if (original)
    groups.push({
      title: "이 테스트의 원본 페이지",
      items: [{ label: `${original.name} 소개(원본)`, href: original.canonical }, ...original.moreInfo.map((m) => ({ label: m.label, href: m.href }))],
    });
  groups.push({ title: "메인 사이트 안내", items: Object.values(MAIN_LINKS).map((l) => ({ label: l.label, href: l.href })) });
  groups.push({ title: "약관과 방침", items: LEGAL_LINKS.map((l) => ({ label: l.label, href: l.href })) });
  return groups;
}
