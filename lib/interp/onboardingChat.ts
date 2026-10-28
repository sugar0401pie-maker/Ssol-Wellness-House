// 온보딩 가설의 "대화 조각" 연결(CSO OB-16, 엔진 ESM v1.8) — 대화에서 확인된 사실을 엔진에 넘기는 순수 부분(2026-10-28).
// 엔진은 ctx.chat = { claims:Set(claim_id), scenes:Set(장면 id), topics:Set(주제), changed:Set(정보 칸) }를 받아, sw_ob_hyp_chat_links에서 match "같음"인 연결이 맞으면
// 수렴 신호 하나(+0.5, 가설당 최대 1.0)로 센다. 앱이 줄 수 있는 사실은 두 가지다:
//  · claims — 장부에 반영된 대화 근거(분류기가 읽은 의미 claim)
//  · topics — 사용자가 직접 꺼낸 주제(돈·돌봄·몸·연애·가족·변화 등: 분류기의 saidTopics가 최근 사용자 말에서 읽음)
//  · cardScenes — 이 사용자가 연 선택지 카드 세션의 장면 키(엔진 ESM v2.4~: 트리 장면·정보 칸 연결을 앱이 아는 신호로 바꿔 읽음, DB 표 sw_ob_chat_link_signals)
// 분류기가 고른 "장면 신호" claim(CS-SCN-*)은 claims에 함께 들어간다(뿌리 점수는 없고 "그 장면 이야기가 나왔다"는 표시만 — growth.ts가 기록).
// scenes(해석 트리의 장면 id 직접)와 changed(대화 중 바뀐 정보 칸 직접)는 앱이 알 수 없어 비워 둔다. 엔진이 위 신호로 대신 판정한다.
export type ChatFacts = { claims: Set<string>; scenes: Set<string>; topics: Set<string>; changed: Set<string>; cardScenes: Set<string> };

type LedgerLike = { source?: string; validity?: string; claim?: string | null };
export function claimsFromStates(states: Record<string, { ledger?: LedgerLike[] }>): Set<string> {
  const out = new Set<string>();
  for (const st of Object.values(states)) for (const e of st.ledger ?? []) if (e.source === "chat" && e.validity === "active" && e.claim) out.add(e.claim);
  return out;
}
export function chatFacts(claims: Set<string>, userTexts: string[], said: (t: string) => string[], cardScenes: Set<string> = new Set()): ChatFacts {
  const topics = new Set<string>();
  for (const t of userTexts) for (const k of said(t)) topics.add(k);
  return { claims, scenes: new Set(), topics, changed: new Set(), cardScenes };
}
// 대화 사실이 달라졌을 때만 온보딩 단서를 다시 계산하려고 쓰는 서명(정렬해서 같은 사실이면 같은 문자열).
export const chatSignature = (c: ChatFacts | null) => (c ? `${[...c.claims].sort().join(",")}|${[...c.topics].sort().join(",")}|${[...c.cardScenes].sort().join(",")}` : "");
