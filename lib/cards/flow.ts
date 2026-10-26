// 선택지 카드 흐름의 순수 판단·변환(2026-10-20, 로드맵 3·4번). 네트워크가 없어 단위 시험이 쉽다.
// 클라이언트에서도 타입을 쓰므로 "server-only"를 넣지 않는다.
import { isInterpEnabled } from "../interp/gate.ts";

// 카드를 여는 경로: 이론 탐색 선택 흐름과 같은 기준(일상 고민·삶의 결정)만. 위기·폭력·임상·서비스 문의에서는 열지 않고 진행 중이던 것도 끝낸다.
export const CARD_ROUTES: ReadonlySet<string> = new Set(["wellness", "life_decision"]);
export const CARD_OFFER_TTL_MS = 15 * 60 * 1000; // 장면을 감지한 뒤 이 시간 안에 이어지는 말에서만 카드를 꺼낸다(대화가 다른 데로 갔으면 접는다)
export const TAP_MARK = "sw-cardtap"; // 카드 보기를 누른 사용자 메시지 표시 — AI 비용이 없어 하루/대화당 메시지 수에서 뺀다
export const CARD_MARK = "sw-card"; // 카드를 보여 준 쏘웰라 메시지 표시

// 기본 켜짐(대표님 결정 2026-10-20: 환경 변수를 따로 넣지 않는다). 끄기: SW_CARDS_ENABLED=0. 일부에게만: SW_CARDS_ALLOWLIST(사용자 id 또는 이메일, 쉼표 구분; 비어 있으면 전체).
export function cardsEnabled(env: { SW_CARDS_ENABLED?: string; SW_CARDS_ALLOWLIST?: string }, userId: string, email?: string | null): boolean {
  if (env.SW_CARDS_ENABLED === "0") return false;
  return isInterpEnabled({ SW_INTERP_ALLOWLIST: env.SW_CARDS_ALLOWLIST }, userId, email);
}

export type CardPick = {
  cardId?: string; // 카드 보기를 누를 때: 지금 보여 준 카드 id
  optionId?: string;
  multi?: [string, string]; // "두 개 이상이에요" 뒤 고른 두 보기
  dk?: true; // "잘 모르겠어요"
  other?: true; // "다른 이유가 있어요" — 사용자가 직접 쓴 글(message)
  confirm?: "CF-1" | "CF-2" | "CF-3"; // 확인 카드 답
};

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,59}$/;
// 요청에서 온 값은 믿지 않고 모양만 확인한다(엔진이 다시 "보여 준 보기만" 받는다).
export function parseCardPick(v: unknown): CardPick | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = (x: unknown) => (typeof x === "string" && ID.test(x) ? x : null);
  if (o.confirm !== undefined) return o.confirm === "CF-1" || o.confirm === "CF-2" || o.confirm === "CF-3" ? { confirm: o.confirm } : null;
  const cardId = id(o.cardId);
  if (!cardId) return null;
  if (o.dk === true) return { cardId, dk: true };
  if (o.other === true) return { cardId, other: true };
  if (Array.isArray(o.multi)) {
    const [a, b] = o.multi.map(id);
    return a && b && a !== b && o.multi.length === 2 ? { cardId, multi: [a, b] } : null;
  }
  const optionId = id(o.optionId);
  return optionId ? { cardId, optionId } : null;
}

export const tapMarker = (p: CardPick): string => `${TAP_MARK}:${p.confirm ?? p.cardId ?? "x"}`;

// 엔진 입력으로 바꾼다. other는 사용자가 쓴 글을 함께 넘긴다.
export function toEnginePick(p: CardPick, text: string): Record<string, unknown> {
  if (p.confirm) return {};
  if (p.dk) return { dk: true };
  if (p.other) return { other: text.slice(0, 200) };
  if (p.multi) return { multi: p.multi };
  return { optionId: p.optionId };
}

export type CardPayload = {
  kind: "card" | "confirm";
  cardId: string; // kind=confirm이면 "CC-CONFIRM"
  text: string; // 말풍선에 보이는 문장(카드 안내문 또는 확인 문장)
  options: { id: string; label: string }[];
  fixed: { id: "FX-MULTI" | "FX-DK" | "FX-OTHER"; label: string }[]; // 확인 카드에는 없다
};

export type PresentLike = { card: { id: string; lead: string }; options: { id: string; text: string }[]; fixed: { id: string; text: string }[] };
export function cardPayload(r: PresentLike): CardPayload {
  return {
    kind: "card", cardId: r.card.id, text: r.card.lead,
    options: r.options.map((o) => ({ id: o.id, label: o.text })),
    fixed: r.fixed.filter((f): f is { id: "FX-MULTI" | "FX-DK" | "FX-OTHER"; text: string } => ["FX-MULTI", "FX-DK", "FX-OTHER"].includes(f.id)).map((f) => ({ id: f.id, label: f.text })),
  };
}
export function confirmPayload(text: string, options: { id: string; text: string }[]): CardPayload {
  return { kind: "confirm", cardId: "CC-CONFIRM", text, options: options.map((o) => ({ id: o.id, label: o.text })), fixed: [] };
}

export const offerExpired = (createdAt: string | Date, now = Date.now()): boolean => now - new Date(createdAt).getTime() > CARD_OFFER_TTL_MS;
