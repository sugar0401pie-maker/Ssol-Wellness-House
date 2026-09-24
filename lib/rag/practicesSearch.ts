import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// wellness_practices(owner가 만든 실천방법 DB, 375개: domain x category x tier)에서 지금
// 대화 상황에 맞을 만한 몇 개를 골라 답변 재료로 준다. 진단이나 처방이 아니라 "지금 해볼 수
// 있는 것"을 구체적으로 제안할 때(자기돌봄, 3턴 이후 요약·제안 등) 참고 자료로만 쓰인다.
// 375행뿐이라 serviceSearch.ts와 같은 이유로 별도 임베딩 없이 글자 bigram 겹침을 쓰고,
// 대화에서 짐작되는 삶의 영역(domain) 일치에 가산점을 준다.

export type PracticeResult = {
  id: string;
  domain: string;
  category: string;
  tier: string;
  title: string;
  detail: string;
};

let cache: { rows: PracticeResult[]; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function loadPractices(): Promise<PracticeResult[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rows;
  const admin = createAdminClient();
  const { data, error } = await admin.from("wellness_practices").select("id,domain,category,tier,title,detail");
  if (error) {
    console.error("wellness_practices 조회 실패:", error.message);
    return cache?.rows ?? [];
  }
  cache = { rows: data ?? [], loadedAt: Date.now() };
  return cache.rows;
}

function bigrams(text: string): Set<string> {
  const clean = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

// 메시지에서 삶의 영역을 아주 단순한 키워드로 짐작한다. 안전 판단이나 검색 하드 필터가 아니라
// 순위 가산점일 뿐이라 틀려도 큰 문제는 없다 — 아무것도 안 걸리면 "나 자신"(범용 자기돌봄)으로 둔다.
// 2026-09-24: 심리테스트 v2의 5개 영역(커리어/연애/관계/나 자신/삶의 방향)과 이름을 맞췄다
// (wellness_practices.domain도 migration 20260924000400으로 같이 재분류함). 육아 관련
// 키워드는 이제 "관계"로 합쳐진다(v2의 "관계" 영역이 가족을 포함).
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  연애: ["남편", "아내", "와이프", "남자친구", "여자친구", "애인", "연인", "배우자"],
  커리어: ["회사", "직장", "상사", "팀장", "동료", "업무", "이직", "퇴사", "커리어", "야근", "면접"],
  관계: ["아이", "아기", "육아", "자녀", "아들", "딸", "친구", "인간관계", "지인", "동창", "선후배", "모임", "가족", "부모님"],
};

function guessDomain(text: string): string {
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return domain;
  }
  return "나 자신";
}

function stripScore(p: PracticeResult & { score: number }): PracticeResult {
  return { id: p.id, domain: p.domain, category: p.category, tier: p.tier, title: p.title, detail: p.detail };
}

export async function searchWellnessPractices(
  message: string,
  recentMessages: { role: "user" | "assistant"; content: string }[],
): Promise<PracticeResult[]> {
  const rows = await loadPractices();
  if (!rows.length) return [];

  const contextText = [...recentMessages.slice(-4).map((m) => m.content), message].join(" ");
  const qBigrams = bigrams(contextText);
  const domain = guessDomain(contextText);

  const scored = rows.map((p) => ({
    ...p,
    score: overlapScore(qBigrams, bigrams(`${p.title} ${p.detail} ${p.category}`)) + (p.domain === domain ? 5 : 0),
  }));

  // 2026-09-22 결정: "단기(가볍게 시작)와 중장기(꾸준히 이어가기·장기 습관)를 섞어서 ~3개
  // 제안"하려면 후보 자체에 tier 다양성이 있어야 한다. 순수 점수 정렬만 하면 "가볍게 시작"
  // 항목(도메인당 25개)이 상위권을 독식해서 중장기 항목이 후보에 아예 안 들어올 수 있다 —
  // 그래서 tier별로 나눠 뽑는다: 단기 2개 + 중장기(꾸준히 이어가기/장기 습관) 각 1개.
  const byTier = (tier: string) => scored.filter((p) => p.tier === tier).sort((a, b) => b.score - a.score);

  const picked = [
    ...byTier("가볍게 시작").slice(0, 2),
    ...byTier("꾸준히 이어가기").slice(0, 1),
    ...byTier("장기 습관·정체성으로").slice(0, 1),
  ];

  return picked.map(stripScore);
}

// 문자열을 32비트 정수로 접는 아주 단순한 해시(FNV-1a류). 암호화 목적이 아니라 "날짜+사용자
// 마다 항상 같은 항목이 나오게" 결정론적으로 고르는 용도일 뿐이다.
function simpleHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 홈 탭의 "오늘의 실천방법" — 하루·사용자 조합마다 항상 같은 항목이 나오도록 날짜+userId를
// 시드로 결정론적으로 고른다(매번 새로고침해도 같은 날엔 같은 제안). "가볍게 시작" 난이도만
// 후보로 써서 부담 없이 오늘 바로 해볼 수 있는 것 위주로 제안한다.
// 2026-09-24: 심리테스트 v2 개편 이후 이 표의 domain(커리어/연애/관계/나 자신/삶의 방향)이
// 심리테스트의 5개 영역과 이름이 같아졌다(위 recategorize 마이그레이션 참고) — 다만 실제
// 개인화는 온보딩 답변(아래)으로 하고, 심리테스트 결과 자체를 진단처럼 연결하지는 않는다(SAFE-005).
// 온보딩 답변(즐거움 카테고리·고민 도메인)이 있으면 그 조합으로 후보를 좁힌다
// ("육아와 무관한데 육아 조언이 나온다"는 피드백 반영). 정확히 맞는 조합이 없거나 아직
// 온보딩을 안 한 사용자는 이전처럼 전체 "가볍게 시작" 목록에서 고른다(완전히 막히지 않도록
// domain만 맞는 것 → 전체 순으로 점점 넓혀가는 fallback).
export async function getDailyPractice(
  userId: string,
  dateKey: string,
  preference?: { category?: string | null; domain?: string | null },
): Promise<PracticeResult | null> {
  const rows = await loadPractices();
  const base = rows.filter((p) => p.tier === "가볍게 시작");
  if (!base.length) return null;

  const { category, domain } = preference ?? {};
  const bothMatch = category && domain ? base.filter((p) => p.category === category && p.domain === domain) : [];
  const domainOnly = domain ? base.filter((p) => p.domain === domain) : [];
  const pool = bothMatch.length ? bothMatch : domainOnly.length ? domainOnly : base;

  const idx = simpleHash(`${dateKey}:${userId}`) % pool.length;
  return pool[idx];
}
