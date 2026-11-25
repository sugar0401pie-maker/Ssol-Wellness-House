// 고민 타파 글마다 들어가는 쏘웰라·쏠 타로 하우스 광고 문구(대표님 2026-11-25 — 운영 중 광고 문구를 "돌려 가며", 글마다 다르게).
// 문구는 대표님이 보낸 광고 소재 그대로(쏘웰라AI 캠페인 #1 · 쏠 타로 하우스 1124_타로_PMax). "32만 명"은 대표님 확인 숫자.
// 타로 설명 중 "결과는 … 미래를 보장하지 않아요"는 타로 사이트 페이지 아래에 이미 있어 여기서는 쓰지 않는다(대표님).
// 같은 글은 늘 같은 조합, 글끼리는 다른 조합 — 글 순서 번호로 고른다(고민우체국 n화 → n-1, 고민 가이드 → 50 + 목록 순서, 그 밖은 글자 값으로).
import { TAROT_ORIGIN } from "../tarot/catalog.ts";

export const SOWELLA_HEADLINES = [
  "프로 갓생러들의 비밀, 쏘웰라AI",
  "작심삼일 챌린지, 3일 무료",
  "연애, 이직, 인간관계 고민 해결",
  "프로 갓생러들의 비밀, 쏘웰라AI - 가입 후 3일간 무료",
  "사주도 별자리도 다 봤는데 내 고민은 아직 그대로라면",
  "작심삼일도 괜찮아요, 3일 무료로 시작하는 갓생 챌린지",
  "미라클 모닝부터 연애 고민까지, 내 하루를 챙기는 쏘웰라 AI",
];
export const SOWELLA_DESCS = [
  "사주, 타로, 점성술을 봐도 해결되지 않는 일상적인 고민을 쏘웰라가 들어드릴게요.",
  "일도 마음도 챙기는 리얼 갓생러라면, 지금 작심삼일 챌린지에 참가하세요!",
  "일상 고민을 들어주고, 내 단점을 강점으로 바꾸도록 돕는 쏘웰라AI.",
];
export const TAROT_HEADLINES = [
  "990원으로 보는 내 고민 타로",
  "지금 심리학자가 읽어주는 타로",
  "재회운 전문 타로",
  "마음을 읽어주는 990원 타로",
  "내 상황을 타로가 읽어줘요",
  "출시 3주 만에 32만 명이 봤어요",
  "심리학 전문 타로마스터",
  "연애·회사 고민 타로",
  "고민 적고 카드 뽑기는 무료",
  "심리테스트 기반 타로",
  "출시 3주 만에 32만 명이 본 심리학 기반 타로, 쏠 타로 하우스",
];
export const TAROT_DESCS = [
  "고민 적기와 카드 뽑기는 무료, 결과는 990원으로 볼 수 있어요.",
  "심리학 전문 타로마스터가 만든 타로로 연애·회사 고민을 물어보세요.",
  "썸, 재회, 이직 고민까지 내 상황을 타로가 읽어줘요.",
];
export const TAROT_NAME = "쏠 타로 하우스";
export const TAROT_URL = TAROT_ORIGIN;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// k번째 글의 문구 조합 — 제목과 설명을 엇갈려 골라 가까운 글끼리 같은 조합이 나오지 않게 한다.
export function promoFor(k: number): { sowella: { headline: string; desc: string }; tarot: { headline: string; desc: string } } {
  const i = Math.abs(Math.floor(k));
  return {
    sowella: { headline: SOWELLA_HEADLINES[i % SOWELLA_HEADLINES.length], desc: SOWELLA_DESCS[Math.floor(i / SOWELLA_HEADLINES.length + i) % SOWELLA_DESCS.length] },
    tarot: { headline: TAROT_HEADLINES[(i * 3) % TAROT_HEADLINES.length], desc: TAROT_DESCS[(i + 1) % TAROT_DESCS.length] },
  };
}

export function promoIndex(kind: "guide" | "post", id: string | number, guideOrder: string[] = []): number {
  if (kind === "post" && typeof id === "number") return id - 1;
  const g = guideOrder.indexOf(String(id));
  return g >= 0 ? 50 + g : hash(`${kind}:${id}`) % 1000;
}
