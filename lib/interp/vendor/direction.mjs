// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v2.3/ssol_direction_v0.2.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 성장 방향 v0.2 (ESM) — 제1장 '웰니스란 무엇인가' 1-2-2·1-2-3 반영(CSO 10-27 · G1·G3)
 * "지금 어디에 있나"가 아니라 "어느 쪽을 향하나"를 기록한다. 뿌리 점수·상태는 바꾸지 않음(DIR-01).
 *  - directionSignals: 분류 결과의 방향 claim(DIR-) → sw_user_signals 행(growth.<축>)
 *  - directionSummary: 최근 30일 vs 그 전 30일 → 리포트 문장(늘었을 때·처음일 때만, 줄었다는 말 없음 · DIR-03)
 *  - useDirection: 뿌리마다 using / dragged / unknown (DIR-04 · 내부 값)
 *  - rootDirectionLine: 뿌리 리포트에 덧붙일 한 줄(DIR-05)
 * 데이터: setDirectionData({ claims: sw_ob_claims(kind='방향'), axes: sw_ob_direction_axes, rootTexts: sw_ob_root_texts })
 */
let DIR_CLAIMS = {}, AXES = [], STRENGTH = {};
const DAY = 86400000;
export const LINES = {
  using: '이 마음을 알아차리고 쓰는 쪽으로 가고 있어요.',
  dragged: '이 마음이 아직 나를 끌고 갈 때가 있어요. 알아차린 것만으로도 이미 한 걸음이에요.',
};
export function setDirectionData({ claims = [], axes = [], rootTexts = [] } = {}) {
  DIR_CLAIMS = Object.fromEntries(claims.filter(c => c.kind === '방향' && c.direction).map(c => [c.claim_id, c.direction]));
  AXES = axes;
  STRENGTH = Object.fromEntries(rootTexts.map(r => [r.root_id, r.strength]));
  return { claims: Object.keys(DIR_CLAIMS).length, axes: AXES.length };
}
const _t = x => (x instanceof Date ? x.getTime() : typeof x === 'number' ? x : Date.parse(x));

/**
 * 분류 결과 → 방향 신호 행. classified = { claims: [{ claim_id, confidence, actor?, hypothetical? }] }
 * ctx = { userId, chatId, messageId, at, rootsInMessage: [root_id], suggestedByAi: bool }
 * DIR-02: 쏘웰라가 먼저 제안한 문장에 "네"만 한 것(suggestedByAi)·남 이야기(actor='other')·가정(hypothetical)은 세지 않음
 */
export function directionSignals(classified, ctx = {}) {
  if (ctx.suggestedByAi) return [];
  const out = [], seen = new Set();
  for (const c of classified?.claims || []) {
    const ax = DIR_CLAIMS[c.claim_id];
    if (!ax || seen.has(ax) || c.actor === 'other' || c.hypothetical) continue;
    seen.add(ax);
    out.push({ user_id: ctx.userId, slot: `growth.${ax}`, source: 'chat', observed_at: ctx.at, ref: ctx.chatId,
      value: { claim_id: c.claim_id, roots: ctx.rootsInMessage || [], message_id: ctx.messageId || null } });
  }
  return out;
}

/** 리포트용 방향 요약. signals = sw_user_signals 행(숨김·취소 제외). opts = { now, windowDays: 30, paused: bool(③-10·S3) } */
export function directionSummary(signals, opts = {}) {
  const now = _t(opts.now ?? Date.now()), W = (opts.windowDays ?? 30) * DAY;
  const live = (signals || []).filter(s => s.slot?.startsWith('growth.') && !s.retracted_at && !s.hidden_at);
  const out = [];
  for (const a of AXES) {
    const xs = live.filter(s => s.slot === a.slot).map(s => _t(s.observed_at));
    const recent = xs.filter(t => t > now - W).length, prev = xs.filter(t => t <= now - W && t > now - 2 * W).length, older = xs.filter(t => t <= now - 2 * W).length;
    let trend = 'none', line = null;
    if (recent && !prev && !older) { trend = 'start'; line = a.report_first; }
    else if (recent > prev) { trend = 'more'; line = a.report_more; }
    else if (recent) trend = 'same';
    out.push({ axis: a.axis, label: a.label, recent, prev, trend, line: opts.paused ? null : line });
  }
  return out;
}

/**
 * 뿌리 하나의 방향(DIR-04). st = 엔진 뿌리 상태(ledger 포함) · signals = growth.* 신호 · opts = { now, windowDays: 30, linkDays: 7 }
 * using: 최근 30일 방향 신호 중 그 뿌리와 같은 메시지였던 것이 있음
 * dragged: 뿌리 유력 이상 + 최근 30일 서로 다른 대화 2번 이상에서 근거 + 그 뿌리에 닿는 방향 신호 없음
 */
export function useDirection(rootId, st, signals, opts = {}) {
  const now = _t(opts.now ?? Date.now()), W = (opts.windowDays ?? 30) * DAY, link = (opts.linkDays ?? 7) * DAY;
  // v0.2(10-27 시뮬 #8·#9): using은 같은 메시지의 뿌리일 때만(시간 연결 뺌) · dragged는 서로 다른 대화 2번 이상
  const chats = new Set((st?.ledger || []).filter(e => e.validity === 'active' && e.source === 'chat' && (e.kind ?? 'evidence') === 'evidence' && e.points > 0 && _t(e.at) > now - W)
    .map(e => e.chat_id || e.at));
  const dir = (signals || []).filter(s => s.slot?.startsWith('growth.') && !s.retracted_at && !s.hidden_at && _t(s.observed_at) > now - W);
  if (dir.some(s => (s.value?.roots || []).includes(rootId))) return 'using';
  if (st && ['likely', 'confirmed'].includes(st.status) && chats.size >= 2) return 'dragged';
  return 'unknown';
}

/** 뿌리 리포트에 덧붙일 한 줄(DIR-05) — using이면 강점 문장 + 쓰는 쪽 · dragged면 부드러운 한 줄 · unknown이면 '' */
export function rootDirectionLine(rootId, use) {
  if (use === 'using') return [STRENGTH[rootId], LINES.using].filter(Boolean).join(' ');
  if (use === 'dragged') return LINES.dragged;
  return '';
}

/** DIR-06: 나를 넘어섬 신호가 최근 30일에 있으면 pacingFilter의 beyondSignal = true */
export function beyondSignal(signals, opts = {}) {
  const now = _t(opts.now ?? Date.now()), W = (opts.windowDays ?? 30) * DAY;
  return (signals || []).some(s => s.slot === 'growth.beyond' && !s.retracted_at && !s.hidden_at && _t(s.observed_at) > now - W);
}
