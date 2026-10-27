// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v1.8/ssol_choice_cards_v0.8.js (수정: RS import 경로 한 줄) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 선택지 카드 엔진 v0.8 (2026-10-18 · 개발 검토 v1.4 반영 · 검수 전 초안) — ESM
 * 규칙 CR-01~20 · 연결 종류 LK-01~04
 * v0.8: 점수·확인 범위·목표는 모두 근거 장부 사건으로(ssol_root_state v0.5 putEvent) — 대화가 바뀌어 DB에서 다시 읽어도 같음(A-2)
 *       정정은 장부에서 그 보기의 사건을 찾아 supersede(세션 메모리에 기대지 않음) · 세션 저장/복원 sessionToRow / sessionFromRow
 * 사건은 sess.events에 쌓임 → 서버가 DB 함수로 기록(op apply / set_status / goal_confirm / supersede)
 * 데이터는 setData()로만 넣음(운영: DB 표 sw_ob_choice_* · 시험: choice_cards_v0.7.json을 시험 코드가 읽어 넣음)
 */
import * as RS from '../../interp/vendor/rootState.mjs';

let DATA = null;
const MAX_CARDS = 3, MAX_DK = 2, CAP_PER_ROOT = 3;
export const CFG = { enabled: false, requireShown: true };   // 기본 꺼짐 · 서버가 보여 준 보기만 받음
export function setData(d) { DATA = d; return DATA; }
export const getData = () => DATA;

export function presentCard(sess, cardId, states = {}, ctx = {}, data = DATA) {
  if (!CFG.enabled && !ctx.force) return { type: 'disabled' };
  const r = pickCardOptions(cardId, states, ctx, data);
  sess.shown = sess.shown || {};
  sess.shown[cardId] = [...r.options.map(o => o.id), ...r.fixed.map(f => f.id)];
  sess.card_id = cardId;
  return { type: 'card', ...r };
}
function _checkShown(sess, ids) {
  if (!CFG.requireShown) return null;
  const shown = (sess.shown || {})[sess.card_id] || [];
  const bad = ids.filter(id => !shown.includes(id));
  return bad.length ? { type: 'invalid_option', card_id: sess.card_id, rejected: bad } : null;
}

export function newChoiceSession(chatId, firstCardId) {
  return { chat_id: chatId, started_card_id: firstCardId, card_id: firstCardId, cards_shown: 0, dk: 0, path: [], evidence: [],
           pending_branch: null, last_option: null, ended: null, no_root_label: null, generalized: null, shown: {}, events: [] };
}
/** sw_choice_sessions 행으로(대화 턴 사이 저장) — events는 장부로 따로 보내고 비움 */
export function sessionToRow(sess, userId) {
  return { user_id: userId, chat_id: sess.chat_id, started_card_id: sess.started_card_id, card_id: sess.card_id, last_option_id: sess.last_option,
    cards_shown: sess.cards_shown, dk_count: sess.dk, path: sess.path, evidence: sess.evidence, shown: sess.shown, pending_branch: sess.pending_branch,
    ended: sess.ended, no_root_label: sess.no_root_label, generalized: sess.generalized };
}
export function sessionFromRow(r) {
  return { chat_id: r.chat_id, started_card_id: r.started_card_id, card_id: r.card_id, last_option: r.last_option_id, cards_shown: r.cards_shown || 0,
    dk: r.dk_count || 0, path: r.path || [], evidence: r.evidence || [], shown: r.shown || {}, pending_branch: r.pending_branch ?? null,
    ended: r.ended ?? null, no_root_label: r.no_root_label ?? null, generalized: r.generalized ?? null, events: [] };
}

/** CR-02·03·04: 보여 줄 보기 3개 고르기 */
export function pickCardOptions(cardId, states = {}, ctx = {}, data = DATA) {
  const card = data.cards[cardId];
  const denied = new Set(ctx.deniedOptions || []), mentioned = new Set(ctx.mentioned || []), hypCues = new Set(ctx.hypCues || []);
  const rejected = r => states[r]?.status === 'rejected';
  const pool = Object.values(data.options).filter(o => o.card === cardId)
    .filter(o => !denied.has(o.id))
    .filter(o => !o.gate || mentioned.has(o.gate))
    .filter(o => !(o.rank_roots.length && o.rank_roots.every(rejected)));
  const rank = o => -o.base_rank * 0.3
    + o.rank_roots.reduce((s, r) => s + Math.min(states[r]?.score || 0, CAP_PER_ROOT) * 0.5, 0)
    + (hypCues.has(o.node) || [...hypCues].some(h => o.node.startsWith(h + '-')) ? 1 : 0);
  const sorted = pool.map(o => ({ o, s: rank(o) })).sort((a, b) => b.s - a.s).map(x => x.o);
  let shown = sorted.slice(0, card.show);
  if (card.level === 1 && !shown.some(o => o.kind !== '마음')) {
    const alt = sorted.find(o => o.kind !== '마음');
    if (alt) shown = [...shown.slice(0, card.show - 1), alt];
  }
  return { card, options: shown, fixed: data.fixed, style: card.style };
}

const _st = (states, userId, root) => states[root] || (states[root] = RS.newRootState(userId, root));
/** CR-10 같은 의미(뿌리|claim)는 큰 쪽 하나 — chat_keys는 장부에서 만든 값이라 대화를 넘어도 유지 */
function _addKeyed(sess, st, key, pts, eid, extra) {
  const prev = st.chat_keys[key] || 0, add = Math.max(0, pts - prev);
  if (add > 0) RS.putEvent(st, { event_id: eid, source: 'chat', points: add, claim: key.split('|')[1], chat_id: sess.chat_id, meta: { key, ...extra } }, sess.events);
  return add;
}

/** CR-06·09·10·11: 보기 고름 → 점수(고른 뿌리에만) → 다음 단계 */
export function recordChoice(sess, states, userId, pick, ctx = {}, data = DATA) {
  sess.events = sess.events || [];
  const fx = pick.stop ? 'FX-STOP' : pick.dk ? 'FX-DK' : (pick.other && !pick.matchedOptionId) ? 'FX-OTHER' : pick.multi ? 'FX-MULTI' : null;
  const chk = _checkShown(sess, [...(pick.multi || (fx ? [] : [pick.optionId || pick.matchedOptionId])), ...(fx && fx !== 'FX-STOP' ? [fx] : [])]);
  if (chk) return chk;
  sess.cards_shown += 1;
  if (pick.stop) { _dropPending(sess, states); return _end(sess, 'user_stop'); }                         // CR-07 ④ 대기 점수 버림
  if (pick.dk) { sess.dk += 1; sess.path.push({ card: sess.card_id, pick: 'FX-DK' });
    const lvl = data.cards[sess.card_id].level;
    if (lvl === 1 || sess.dk >= MAX_DK) return _end(sess, 'dont_know', '모름'); return { type: 'card', card_id: sess.card_id, retry: true, exclude_shown: true }; }
  if (pick.other && !pick.matchedOptionId) { sess.path.push({ card: sess.card_id, pick: 'FX-OTHER', text: pick.other }); return _end(sess, 'choice_unmatched'); }
  const ids = pick.multi || [pick.optionId || pick.matchedOptionId];
  const opts = ids.map(id => data.options[id]);
  const half = ids.length > 1 ? 0.5 : 1;
  for (const o of opts) {
    const evId = `${o.card}:${o.id}:${sess.chat_id}`;
    if (sess.evidence.some(e => e.id === evId)) continue;
    const gained = [], pending = [], goals = [];
    for (const r of o.roots) {
      const st = _st(states, userId, r.root), link = r.link || 'support';
      const claim = o.claim_id || o.meaning_key, eid = `${evId}:${r.root}`, meta = { option: o.id, card: o.card };
      if (link === 'goal') {                                                                              // LK-03 목표만
        RS.putEvent(st, { event_id: eid, source: 'chat', link, polarity: r.polarity, points: 0, claim, chat_id: sess.chat_id, meta: { ...meta, goal_points: r.points * half } }, sess.events);
        goals.push({ root: r.root, polarity: r.polarity, eid }); continue;
      }
      if (link === 'conditional') {                                                                       // LK-02 확인 대기(0점 기록)
        RS.putEvent(st, { event_id: eid, source: 'chat', link, points: 0, claim, chat_id: sess.chat_id, meta: { ...meta, pending_points: r.points * half } }, sess.events);
        pending.push({ root: r.root, points: r.points * half, key: `${r.root}|${claim}`, eid }); continue;
      }
      const add = _addKeyed(sess, st, `${r.root}|${claim}`, r.points * half, eid, meta);
      if (add) gained.push({ root: r.root, points: add, eid });
    }
    sess.evidence.push({ id: evId, option: o.id, gained, pending, goals, validity: 'active' });
  }
  let next = opts[0];
  if (opts.length > 1) {
    const { options } = pickCardOptions(sess.card_id, states, ctx, data);
    next = options.find(o => ids.includes(o.id)) || opts[0];
    sess.pending_branch = opts.find(o => o.id !== next.id)?.id || null;
  }
  sess.path.push({ card: sess.card_id, pick: ids.join('+') });
  sess.last_option = next.id;
  if (next.next_card && sess.cards_shown < MAX_CARDS) { sess.card_id = next.next_card; return { type: 'card', card_id: next.next_card }; }
  if (next.kind !== '마음' && !next.core_thought) return _end(sess, 'no_root', next.kind, next);
  if (next.core_thought) return { type: 'confirm', option_id: next.id, text: data.confirm.template.replace('{기저생각}', next.core_thought), options: data.confirm.options };
  return _end(sess, 'max_cards', null, next);
}

function _dropPending(sess, states) {                                                                    // 대기(조건부) 사건 정정
  for (const ev of sess.evidence) { for (const p of ev.pending || []) if (states[p.root]) RS.supersedeEvent(states[p.root], p.eid, sess.events, 'dropped'); ev.pending = []; }
}
/** 근거 되돌리기(정정·CF-3): 장부에서 그 대화의 그 보기 사건을 찾아 모두 supersede */
function _revert(sess, states, optionId) {
  for (const st of Object.values(states))
    RS.supersedeWhere(st, e => e.source === 'chat' && e.chat_id === sess.chat_id && e.meta?.option === optionId && e.kind === 'evidence', sess.events, 'corrected');
  for (const ev of sess.evidence) if (ev.option === optionId) ev.validity = 'superseded';
}

/** CR-08·16 확인 카드 — 확인 범위는 그 보기의 주장 하나 */
export function confirmChoice(sess, states, cfId, at, data = DATA) {
  sess.events = sess.events || [];
  const o = data.options[sess.last_option];
  if (cfId === 'CF-3') { _revert(sess, states, o.id); _dropPending(sess, states); return _end(sess, 'confirm_rejected', null, o); }
  const scored = o.roots.filter(r => (r.link || 'support') !== 'goal').sort((a, b) => b.points - a.points);
  const main = scored[0];
  const scope = { option_id: o.id, claim: o.core_thought, module: data.cards[o.card].module, chat_id: sess.chat_id, at, generalized: cfId === 'CF-2' };
  if (main) {
    for (const ev of sess.evidence) {                                                                    // LK-02 대기 점수 반영: 확인한 보기의 뿌리만
      for (const p of ev.pending || []) if (scored.some(r => r.root === p.root)) {
        const st = states[p.root]; const add = _addKeyed(sess, st, p.key, p.points, `${p.eid}:confirmed`, { option: ev.option, confirms: p.eid });
        if (add) ev.gained.push({ root: p.root, points: add, eid: `${p.eid}:confirmed` });
      }
      ev.pending = [];
    }
    const st = states[main.root];
    RS.recordAnswer(st, 'accepted', at, sess.chat_id, sess.events, { event_id: `${o.card}:${o.id}:${sess.chat_id}:status:${main.root}`, scope });
    if (cfId === 'CF-2') { RS.putEvent(st, { event_id: `${o.card}:${o.id}:${sess.chat_id}:CF-2`, source: 'chat', points: 1.0, claim: (o.claim_id || o.meaning_key) + ':generalized', chat_id: sess.chat_id, at, meta: { option: o.id, generalized: true } }, sess.events); sess.generalized = true; }
    else sess.generalized = false;
  } else {                                                                                                // 목표만 → 목표 확인(상태 그대로)
    for (const r of o.roots) { const st = states[r.root]; if (st) RS.putEvent(st, { event_id: `${o.card}:${o.id}:${sess.chat_id}:goal:${r.root}`, kind: 'goal_confirm', source: 'chat', scope, chat_id: sess.chat_id, at }, sess.events); }
  }
  return _end(sess, 'confirmed', null, o);
}

/** CR-17 정정: 앞선 보기를 고쳐 말함 → 그 보기 근거·확인을 supersede(확인 고착 금지), 새 보기가 있으면 다시 기록 */
export function correctChoice(sess, states, userId, wrongOptionId, newPick = null, ctx = {}, data = DATA) {
  sess.events = sess.events || [];
  _revert(sess, states, wrongOptionId);
  for (const st of Object.values(states)) {
    const n = RS.supersedeWhere(st, e => (e.kind === 'status' || e.kind === 'goal_confirm') && e.scope?.option_id === wrongOptionId && e.scope?.chat_id === sess.chat_id, sess.events, 'corrected');
    if (n) st.answer = 'corrected';
  }
  if (!newPick) return _end(sess, 'corrected');
  sess.cards_shown = Math.max(0, sess.cards_shown - 1);
  return recordChoice(sess, states, userId, newPick, ctx, data);
}

function _end(sess, reason, label = null, opt = null) {
  sess.ended = reason; sess.no_root_label = label;
  return { type: 'stop', reason, label, option_id: opt?.id || null, practice: opt?.practice || {}, pending_branch: sess.pending_branch };
}
