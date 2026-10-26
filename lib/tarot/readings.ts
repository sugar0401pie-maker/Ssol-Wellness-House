import { TAROT_CARDS, TAROT_DOMAINS, TAROT_EMOTIONS, TAROT_NEEDS, TAROT_POSITIONS } from "./catalog.ts";

// 쏠 타로 결과(tarot_sessions 한 줄)를 마이페이지·채팅용으로 다듬는 순수 함수(네트워크 없음 → 단위 테스트 가능).
// 2026-10-07 owner 요청: 타로 결과를 마이페이지에 보여 주고 채팅 개인화에도 쓴다.
// 고민 원문(worry_text)은 여기서 다루지 않는다 — 채팅에 원문을 넘길지는 아직 정하지 않았다(타로 저장소 docs/05_다음단계.md).

export type TarotRow = {
  id: string;
  created_at: string;
  picks: { id: string; reversed: boolean; position: string }[] | null;
  classification: { domain?: string; emotions?: string[]; need?: string; self_focus?: boolean; off_topic?: boolean } | null;
  worry_skipped: boolean | null;
};

export type TarotReading = {
  id: string;
  createdAt: string;
  cards: { position: string; positionName: string; name: string; character: string; reversed: boolean; image: string }[];
  // 고민을 적고 분류에 성공한 경우만. 미작성·분류 실패·장난 글이면 null.
  topic: { domain: string; emotions: string[]; need: string } | null;
};

export function toReading(row: TarotRow, imageOrigin: string): TarotReading | null {
  const picks = Array.isArray(row.picks) ? row.picks : [];
  const cards = picks
    .map((p) => {
      const c = TAROT_CARDS[p.id];
      if (!c) return null;
      return {
        position: p.position,
        positionName: TAROT_POSITIONS[p.position] ?? p.position,
        name: c.name,
        character: c.character,
        reversed: Boolean(p.reversed),
        image: `${imageOrigin}/images/tarot/${c.image}`,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  // 3장을 다 뽑은 결과만 보여 준다(중간에 그만둔 세션은 제외).
  if (cards.length !== 3) return null;
  const cls = row.classification;
  const topic =
    cls && !cls.off_topic && cls.domain && TAROT_DOMAINS[cls.domain] && cls.need && TAROT_NEEDS[cls.need]
      ? {
          domain: cls.self_focus ? "나 자신과 삶의 방향" : TAROT_DOMAINS[cls.domain],
          emotions: (cls.emotions ?? []).map((e) => TAROT_EMOTIONS[e]).filter(Boolean),
          need: TAROT_NEEDS[cls.need],
        }
      : null;
  return { id: row.id, createdAt: row.created_at, cards, topic };
}

// 채팅 프롬프트에 넣는 최근 타로 결과 요약. 너무 오래된 결과는 지금 이야기와 상관없을 가능성이 커서 넣지 않는다.
export const TAROT_HINT_MAX_AGE_DAYS = 30;

export function buildTarotHint(readings: TarotReading[], now: Date = new Date()): string | null {
  const latest = readings[0];
  if (!latest) return null;
  const ageDays = (now.getTime() - new Date(latest.createdAt).getTime()) / 86400000;
  if (!(ageDays >= 0 && ageDays <= TAROT_HINT_MAX_AGE_DAYS)) return null;
  const when = ageDays < 1 ? "오늘" : `${Math.floor(ageDays)}일 전`;
  const cards = latest.cards
    .map((c) => `${c.positionName}: ${c.name}(${c.character})${c.reversed ? " · 역방향" : ""}`)
    .join(" / ");
  const topic = latest.topic
    ? ` 그때 적은 고민은 ${latest.topic.domain} 쪽으로 읽혔고, ${latest.topic.emotions.join("·") || "여러 감정"}이 느껴지며 '${latest.topic.need}'이 필요해 보였다.`
    : " 고민은 적지 않고 마음속으로만 떠올렸다.";
  return `${when} 쏠 타로 하우스에서 뽑은 세 장 — ${cards}.${topic}`;
}
