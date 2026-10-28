// 성장 방향·동기 위치 기록의 순수 부분(CSO 제1장, 2026-10-28). DB·네트워크 없이 시험한다. 엔진 함수(vendor/direction·motive)는 호출하는 쪽에서 불러 온다.
// 저장하는 것은 항목 이름(slot)·claim id·뿌리 id·메시지 id·시각뿐이다 — 사용자 말 조각은 저장하지 않는다.

export type SignalRow = { user_id: string; slot: string; value: Record<string, unknown> | null; source?: string; observed_at: string; ref?: string | null };
export type StoredSignal = { slot: string; value: Record<string, unknown> | null; observed_at: string; ref?: string | null; retracted_at?: string | null; hidden_at?: string | null };

// DIR-02 / MV: 쏘웰라가 먼저 제안한 문장에 "네"만 한 짧은 대답은 본인이 한 말로 세지 않는다.
const YES = /^\s*(네|넵|예|응|어|그래요|그럼요|맞아요|좋아요|좋네요|그렇게요|해볼게요|해 볼게요|해볼래요|그럴게요)[\s.!~요,]*$/;
export const suggestedByBot = (lastBot: string | null | undefined, text: string): boolean =>
  !!lastBot && lastBot.trim().length > 0 && (YES.test(text) || (text.trim().length <= 6 && /^(네|응|예|넵)/.test(text.trim())));

// 같은 메시지·같은 claim·같은 항목은 한 번만 기록한다(해석이 다시 돌아도 중복되지 않게).
const keyOf = (r: { slot: string; value: Record<string, unknown> | null }) => `${r.slot}|${String(r.value?.message_id ?? "")}|${String(r.value?.claim_id ?? "")}`;
export function freshRows(rows: SignalRow[], existing: StoredSignal[]): SignalRow[] {
  const have = new Set(existing.map(keyOf));
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = keyOf(r);
    if (have.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 엔진이 만든 행에 메시지 id를 덧붙인다(동기 위치 행에는 원래 없음). */
export const withMessage = (rows: SignalRow[], messageId: string): SignalRow[] =>
  rows.map((r) => ({ ...r, value: { ...(r.value ?? {}), message_id: (r.value?.message_id as string | null | undefined) ?? messageId } }));

/** 가장 최근에 기록된 동기 위치(실천 추천의 MV-03 가산용: 엔진이 한 값만 받는다). 없으면 null. */
export const latestMotivePosition = (signals: StoredSignal[]): string | null => {
  const xs = signals.filter((s) => s.slot.startsWith("motive.") && !s.retracted_at && !s.hidden_at && typeof s.value?.position === "string").sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  return xs.length ? (xs[xs.length - 1].value!.position as string) : null;
};

/** 신호 목록에서 동기 위치 영역 목록(motive.<영역>)을 뽑는다. */
export const motiveDomains = (signals: StoredSignal[]): string[] =>
  [...new Set(signals.filter((s) => s.slot.startsWith("motive.") && !s.retracted_at && !s.hidden_at).map((s) => s.slot.slice("motive.".length)))];
