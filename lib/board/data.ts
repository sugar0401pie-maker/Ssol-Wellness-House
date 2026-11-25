// 고민 타파(요청문 v1.9.4 10장). 글과 그림은 로그인 없이 볼 수 있는 공개 사이트(www.ssolwellnesshouse.com)에 한 번만 쓰고, 앱은 가져와 보여 준다.
// 2026-11-25 확인: 공개 사이트에 /guide 글과 목록 데이터(index.json)가 아직 없다 — 그래서 요청문 10-3·10-5장의 목록(태그·제목·"먼저 한 줄로" 3줄, 연재 예시 3편)을
// "처음 목록"으로 두고, 공개 목록이 생기면 그쪽을 우선 쓴다(lib/board/fetchSite.ts). 본문은 공개 글이 올라오기 전에는 없다.
// 클라이언트도 쓰므로 "server-only"를 넣지 않는다.

export const SITE_ORIGIN = "https://www.ssolwellnesshouse.com";
export const GUIDE_INDEX_URL = `${SITE_ORIGIN}/guide/index.json`;
export const POST_INDEX_URL = `${SITE_ORIGIN}/postoffice/index.json`;
export const guideUrl = (slug: string) => `${SITE_ORIGIN}/guide/${slug}`;
export const episodeUrl = (n: number) => `${SITE_ORIGIN}/postoffice/${n}`;

// bodyHtml: 관리자 화면에서 쓴 글이면 본문 HTML(허용 태그만), 아니면 없음(그때는 url에서 가져온다).
export type Guide = { tag: string; slug: string; title: string; lines: string[]; url: string; updated?: string | null; bodyHtml?: string | null };
export type Episode = { n: number; title: string; tag: string; summary: string; url: string; published?: string | null; image?: string | null; bodyHtml?: string | null };

const g = (tag: string, slug: string, title: string, lines: string[]): Guide => ({ tag, slug, title, lines, url: guideUrl(slug) });
export const STARTER_GUIDES: Guide[] = [
  g("재회", "reunion-possibility", "재회 가능성, 있는 경우와 없는 경우를 어떻게 가늠할까요", ["헤어진 이유가 바뀔 수 있는 것인지", "지금 두 사람 모두 다시 만날 마음의 여유가 있는지", "내가 바라는 게 '그 사람'인지 '이 외로움이 끝나는 것'인지"]),
  g("썸", "is-this-ssom", "썸인지 헷갈릴 때, 어떻게 확인할까요", ["내가 본 '사실'과 내 '해석'을 따로 적어 보기", "내가 바라는 게 '지금 이 상태'인지 '더 가까워지는 것'인지", "상대 마음은 짐작보다 대답하기 쉬운 제안으로 확인하기"]),
  g("이직", "job-change-or-stay", "이직할까 말까 고민될 때, 무엇부터 따져 볼까요", ["싫은 게 회사인지, 일인지, 쉬고 싶은 마음인지", "그 이유가 옮긴 곳에도 따라올지", "옮기는 것 말고 지금 바꿔 볼 수 있는 게 있는지"]),
  g("퇴사", "quit-job-checklist", "퇴사 고민될 때, 그만두고 싶은 마음을 어떻게 살펴볼까요", ["그만두고 싶은 마음이 '지침'에서 나오는지, '방향'에서 나오는지", "지치는 순간과 괜찮은 순간을 나눠 적어 보기", "큰 결정 전에 작게 바꿔 볼 수 있는 것부터 해 보기"]),
  g("소비습관", "spending-habits", "소비 습관을 고치고 싶을 때, 어디서부터 시작할까요", ["쓴 돈을 '꼭 필요 / 기분 따라 / 모르겠음' 세 칸으로 나누기", "돈 쓸 때와 쓰고 난 뒤의 기분 돌아보기", "한 번에 하나만 바꾸기"]),
  g("주말휴식", "weekend-rest", "주말에 쉬었는데 안 쉰 것 같을 때, 어떻게 쉬면 좋을까요", ["몸, 머리, 마음 중 어디가 쉬지 못했는지", "쉬는 시간에도 나에게 맞는 것 한 가지 정하기", "시작과 끝을 정해 두기"]),
  g("앰비버트", "ambivert", "앰비버트 뜻, 나는 내향일까 외향일까", ["앰비버트는 내향과 외향의 중간쯤에 있는 사람을 가리키는 말", "유형 이름보다 언제 힘이 나고 빠지는지가 더 도움이 될 수 있어요", "유형은 나를 설명하는 참고일 뿐 정답은 아니에요"]),
  g("타로", "can-i-trust-tarot", "타로가 맞는 것 같을 때, 믿어도 될까요", ["타로가 미래를 맞힌다고 입증된 것은 아니에요", "타로는 질문을 얻고 생각을 정리하는 도구로 쓰면 도움이 될 수 있어요", "중요한 결정을 카드만으로 정하지 않는 게 안전해요"]),
  g("별자리", "why-zodiac-feels-like-me", "별자리 성격 풀이가 나 같을 때, 왜 그럴까요", ["나 같다고 느끼는 데에는 여러 이유가 있을 수 있어요", "다른 별자리 풀이도 비슷하게 맞는 느낌이 들 수 있어요", "풀이는 나를 정해 주기보다 나를 말하게 하는 도구로 쓸 수 있어요"]),
  g("카톡답장", "no-reply-kakao", "카톡 답장이 안 올 때, 어떻게 기다릴까요", ["지금 확실히 아는 사실은 '내가 보냈다'는 것뿐일 수 있어요", "답이 늦는 이유는 대부분 지금은 알 수 없어요", "기다리는 시간은 내 시간으로 쓸 수 있어요"]),
  g("단톡방서운함", "group-chat-hurt", "단톡방에서 내 말에만 답이 늦어 서운할 때", ["서운한 마음과 확인된 사실을 나눠 보기", "답이 늦은 이유는 지금은 알 수 없는 경우가 많아요", "말한다면 탓하기보다 내 마음을 가볍게 말하기"]),
];

// 연재 예시 3편(요청문 10-5장 — 인스타툰 번외 제목을 빌린 예시, 실제 연재 글과 순서는 대표님이 정함).
export const STARTER_EPISODES: Episode[] = [
  { n: 1, tag: "썸", title: "이거 썸 맞아? 답장은 빠른데 만나자는 말은 없었다", summary: "매일 인사는 오가는데 약속 얘기는 없는 거북 때문에 헷갈리는 펭귄. 조개의 질문으로 '있었던 일'과 '내 해석'을 나눠 적고, 상대 마음을 짐작하는 대신 대답하기 쉬운 약속 한 줄을 보낸다.", url: episodeUrl(1) },
  { n: 2, tag: "이직", title: "이직할까 말까, 오늘도 생각만 하다 퇴근했다", summary: "점심마다 채용 공고를 여는 거북. 조개의 질문으로 '회사가 싫은 건지, 일이 싫은 건지, 쉬고 싶은 건지'를 나눠 적고, 오늘은 결정하지 않고 확인할 것 세 가지만 정한다.", url: episodeUrl(2) },
  { n: 3, tag: "퇴사", title: "퇴사하고 싶다는 말을, 오늘은 속으로만 일곱 번 했다", summary: "일요일 저녁부터 마음이 무거운 펭귄. 조개의 질문으로 지치는 순간과 괜찮은 순간을 나눠 적고, 큰 결정은 서두르지 않은 채 점심 한 시간을 지키는 작은 변화부터 해 본다.", url: episodeUrl(3) },
];

// 고민우체국 그림(요청문 14-6장 제안): 연재 소개는 해달(대표), 회차 표지는 1화 해달·2화 수달·3화 해달처럼 번갈아(4화부터 표지가 새로 오면 같은 규칙).
// 공개 사이트에 그림이 올라오면 목록 데이터의 image 주소를 우선 쓴다.
export const POST_INTRO_IMAGE = "/postoffice/sea-open.webp";
export const episodeCover = (n: number): string | null => (n >= 1 && n <= 3 ? `/postoffice/${n % 2 === 1 ? "sea" : "river"}-cover${n}.webp` : null);
export const episodeCut = (n: number): string => `/postoffice/${n % 2 === 1 ? "river" : "sea"}-write.webp`;

// 글자 구름 점수표(요청문 10-3장 — 시안의 예시, 실제 점수는 CSO 확정 예정). 기준: 기저 생각 3가지 + 테스트 전(많이 찾는 순). 태그 순서는 STARTER_GUIDES와 같다.
export type Basis = "worry" | "delay" | "energy" | "none";
export const SCORES: Record<Basis, Record<string, number>> = {
  worry: { 재회: 4, 썸: 4, 이직: 2, 퇴사: 2, 소비습관: 1, 주말휴식: 1, 앰비버트: 1, 타로: 3, 별자리: 2, 카톡답장: 5, 단톡방서운함: 3 },
  delay: { 재회: 1, 썸: 1, 이직: 5, 퇴사: 4, 소비습관: 4, 주말휴식: 3, 앰비버트: 2, 타로: 1, 별자리: 1, 카톡답장: 1, 단톡방서운함: 1 },
  energy: { 재회: 2, 썸: 1, 이직: 2, 퇴사: 4, 소비습관: 2, 주말휴식: 5, 앰비버트: 3, 타로: 2, 별자리: 2, 카톡답장: 1, 단톡방서운함: 3 },
  none: { 재회: 3, 썸: 4, 이직: 5, 퇴사: 5, 소비습관: 4, 주말휴식: 2, 앰비버트: 2, 타로: 2, 별자리: 3, 카톡답장: 4, 단톡방서운함: 1 },
};
export const BASIS_SUB: Record<Basis, string> = {
  worry: '"걱정이 머릿속을 떠나지 않아요"에 가까운 고민을 크게 보여 줘요.',
  delay: '"할 일을 자꾸 미뤄요"에 가까운 고민을 크게 보여 줘요.',
  energy: '"몸도 마음도 기운이 없어요"에 가까운 고민을 크게 보여 줘요.',
  none: "아직 테스트를 안 했다면, 많이 찾는 고민 순서로 보여 줘요.",
};
export const scoreOf = (basis: Basis, tag: string): number => SCORES[basis][tag] ?? 2; // 점수표에 없는 새 태그는 중간보다 조금 아래
export const CLOUD_MAX = 12; // 한 번에 보이는 태그 수(점수 낮은 순으로 숨김)
