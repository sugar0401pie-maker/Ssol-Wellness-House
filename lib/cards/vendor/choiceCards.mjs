// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.23/ssol_choice_cards_v0.17.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 선택지 카드 엔진 v0.17 (11-17: ctx.preferOptions — 세부 고민에 맞는 보기를 먼저 · 장면은 그대로) · v0.13 (10-28 CSO 피드백: 출처별 확률 순서 · 1단 갈래 근거 · 다른 이유 더 보기 · 확인 4단계 · 1단 건너뛰기) · v0.8 (2026-10-18 · 개발 검토 v1.4 반영 · 검수 전 초안) — ESM
 * 규칙 CR-01~20 · 연결 종류 LK-01~04
 * v0.8: 점수·확인 범위·목표는 모두 근거 장부 사건으로(ssol_root_state v0.5 putEvent) — 대화가 바뀌어 DB에서 다시 읽어도 같음(A-2)
 *       정정은 장부에서 그 보기의 사건을 찾아 supersede(세션 메모리에 기대지 않음) · 세션 저장/복원 sessionToRow / sessionFromRow
 * 사건은 sess.events에 쌓임 → 서버가 DB 함수로 기록(op apply / set_status / goal_confirm / supersede)
 * 데이터는 setData()로만 넣음(운영: DB 표 sw_ob_choice_* · 시험: choice_cards_v0.21.json을 시험 코드가 읽어 넣음)
 */
import * as RS from '../../interp/vendor/rootState.mjs';

let DATA = null;
const MAX_CARDS = 3, MAX_DK = 2, CAP_PER_ROOT = 3;
export const CFG = { enabled: false, requireShown: true,
  // CSO 10-28 피드백 3: 보기 순서는 출처별 가중 확률(지금 대화 > 온보딩 > 테스트 > 아스트로)
  sourceWeight: { chat: 1.0, human: 1.0, onboarding: 0.8, test: 0.6, astro_q: 0.4, astro_profile: 0.4 },
  branchBoost: 0.5, priorWeight: 1.0, baseRankWeight: 0.15, preferBoost: 2.0,   // v0.17(11-17): 첫 말의 세부 고민에 맞는 보기(ctx.preferOptions · sw_ob_worry_entry)는 +2.0 — 빈 장부면 기본 순서보다 앞섬(기본 순위 차 최대 1.5) · 뿌리 확률이 쌓이면(뿌리당 최대 3) 확률이 앞섬   // 10-28: 보기 순서 = 확률(가중 합 × 1.0) − 기본 순위 × 0.15
        // 1단 갈래 근거 → 2·3단 순서 가산 · 끝 뿌리가 갈래 안이면 +0.5 · 멈추면 확률 1위 뿌리 0.5
  skipMin: 2.0, skipRatio: 2.0, signalWeight: 0.5,   // 피드백 4: 1단 건너뛰기 — 확률 1위 ≥ 2.0 이고 2위의 2배 이상(임시값 · 시뮬레이션으로 조정)
};   // 기본 꺼짐 · 서버가 보여 준 보기만 받음
export function setData(d) { DATA = d; return DATA; }
export const getData = () => DATA;

export function presentCard(sess, cardId, states = {}, ctx = {}, data = DATA) {
  if (!CFG.enabled && !ctx.force) return { type: 'disabled' };
  const r = pickCardOptions(cardId, states, { ...ctx, branchRoots: sess.branch?.roots || ctx.branchRoots, deniedOptions: [...(ctx.deniedOptions || []), ...((sess.denied || {})[cardId] || [])] }, data);   // 10-28: 모름 뒤 앞서 보인 보기는 엔진이 뺌
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
    ended: sess.ended, no_root_label: sess.no_root_label, generalized: sess.generalized,
    denied: sess.denied || {}, unmatched: sess.unmatched || 0, rejected_claims: sess.rejected_claims || [], branch: sess.branch || null, branch_paid: !!sess.branch_paid, skip_offer: sess.skip_offer || null, deficit_root: sess.deficit_root || null };   // 10-28 v3.1 · 11-04 deficit_root
}
export function sessionFromRow(r) {
  return { chat_id: r.chat_id, started_card_id: r.started_card_id, card_id: r.card_id, last_option: r.last_option_id, cards_shown: r.cards_shown || 0,
    dk: r.dk_count || 0, path: r.path || [], evidence: r.evidence || [], shown: r.shown || {}, pending_branch: r.pending_branch ?? null,
    ended: r.ended ?? null, no_root_label: r.no_root_label ?? null, generalized: r.generalized ?? null,
    denied: r.denied || {}, unmatched: r.unmatched || 0, rejected_claims: r.rejected_claims || [], branch: r.branch || null, branch_paid: !!r.branch_paid, skip_offer: r.skip_offer || null, deficit_root: r.deficit_root || null, events: [] };
}

/** CR-02·03·04: 보여 줄 보기 3개 고르기 */
export function pickCardOptions(cardId, states = {}, ctx = {}, data = DATA) {
  const card = data.cards[cardId];
  const denied = new Set(ctx.deniedOptions || []), mentioned = new Set(ctx.mentioned || []), hypCues = new Set(ctx.hypCues || []);
  const rejected = r => states[r]?.status === 'rejected';
  const pool = Object.values(data.options).filter(o => o.card === cardId)
    .filter(o => !denied.has(o.id))
    .filter(o => !o.gate || [].concat(o.gate).some(g => mentioned.has(g)))   // 10-27: gate는 주제 키 목록 · 'never'면 카드에 안 띄움
    .filter(o => !(o.rank_roots.length && o.rank_roots.every(rejected)));
  const br = new Set(ctx.branchRoots || []);
  const pref = new Set(ctx.preferOptions || []);
  const rank = o => -o.base_rank * CFG.baseRankWeight + (o.gate && !o.gate.includes('never') ? 1 : 0)   // 10-28 시뮬 #6e: 본인이 꺼낸 주제로 열린 🔸 보기는 +1(열리고도 순위에 밀려 안 보이던 것)
    + o.rank_roots.reduce((s, r) => s + Math.min(prior(states[r]), CAP_PER_ROOT) * CFG.priorWeight, 0)   // 10-28 CSO: 출처별 가중 확률이 먼저, 기본 순서는 비슷할 때만
    + (br.size && [...o.rank_roots, ...o.roots.map(x => x.root)].some(r => br.has(r)) ? CFG.branchBoost : 0)   // 1단 갈래 근거
    + (hypCues.has(o.node) || [...hypCues].some(h => o.node.startsWith(h + '-')) ? 1 : 0)
    + (pref.has(o.id) ? CFG.preferBoost : 0);   // v0.17
  const sorted = pool.map(o => ({ o, s: rank(o) })).sort((a, b) => b.s - a.s).map(x => x.o);
  let shown = sorted.slice(0, card.show);
  { // 10-28 3차: 본인이 꺼낸 주제로 열린 🔸 보기는 한 자리 보장(열리고도 순위에 밀려 안 보이던 것)
    const g = sorted.find(o => o.gate && !shown.includes(o));
    if (g && !shown.some(o => o.gate)) { const i = [...shown].reverse().findIndex(o => o.kind === '마음'); if (i >= 0) shown[shown.length - 1 - i] = g; }
  }
  if (card.level === 1 && !shown.some(o => o.kind !== '마음')) {
    const alt = sorted.find(o => o.kind !== '마음');
    if (alt) shown = [...shown.slice(0, card.show - 1), alt];
  }
  return { card, options: shown, fixed: data.fixed, style: card.style };
}

/** 10-28 CSO 피드백 3: 뿌리 하나의 출처별 가중 확률 — 장부(활성 근거)를 출처마다 무게를 곱해 더함 · 장부가 없으면 점수 그대로 */
export function prior(st) {
  if (!st) return 0;
  const ev = (st.ledger || []).filter(e => e.validity === 'active' && (e.kind ?? 'evidence') === 'evidence' && e.points > 0);
  if (!ev.length) return st.score || 0;
  return ev.reduce((a, e) => a + e.points * (CFG.sourceWeight[e.source] ?? 1.0) * (e.meta?.via === 'signal' ? CFG.signalWeight : 1), 0);   // 11-04 SIG6 1안: 판별 문장 근거는 순서·건너뛰기에서 0.5배(점수 상한 2.0은 그대로)
}
const _code = id => String(id || '').split('-')[1];   // 카드·보기 id의 장면 코드(CC-NTH-2-… → NTH)
/** 10-28 3차: 모름 다시 묻기에 남는 보기(앞서 보인 보기 · 서버 deniedOptions 뺌) */
function _remaining(sess, cardId, states, ctx, data) {
  const denied = [...(ctx.deniedOptions || []), ...((sess.denied || {})[cardId] || [])];
  return pickCardOptions(cardId, states, { ...ctx, deniedOptions: denied }, data).options;
}
const _st = (states, userId, root) => states[root] || (states[root] = RS.newRootState(userId, root));
/** CR-10 같은 의미(뿌리|claim)는 큰 쪽 하나 — chat_keys는 장부에서 만든 값이라 대화를 넘어도 유지 */
function _addKeyed(sess, st, key, pts, eid, extra) {
  // 10-27 시뮬 #7: 한 경로(카드 세션)에서 한 뿌리는 가장 큰 값 하나 — 2단 0.5 + 3단 1.0 = 1.0 (확인 대기 반영은 예외)
  const root = key.split('|')[0];
  const pathGot = extra?.confirms ? 0 : (sess.evidence || []).filter(e => e.validity === 'active').flatMap(e => e.gained || []).filter(g => g.root === root).reduce((a, g) => a + g.points, 0);
  const prev = Math.max(st.chat_keys[key] || 0, pathGot), add = Math.max(0, pts - prev);
  if (add > 0) RS.putEvent(st, { event_id: eid, source: 'chat', points: add, claim: key.split('|')[1], chat_id: sess.chat_id, meta: { key, ...extra } }, sess.events);
  return add;
}

/** CR-06·09·10·11: 보기 고름 → 점수(고른 뿌리에만) → 다음 단계 */
export function recordChoice(sess, states, userId, pick, ctx = {}, data = DATA) {
  const out = _recordChoice(sess, states, userId, pick, ctx, data);
  const ids = pick.multi || [pick.optionId || pick.matchedOptionId];
  if (out.type !== 'invalid_option' && ids.some(id => data.options[id]?.safety_hint)) out.safety_check = true;   // 10-27 시뮬 #6: 서버가 lib/safety에 넘김(엔진은 판단 안 함)
  return out;
}
function _recordChoice(sess, states, userId, pick, ctx = {}, data = DATA) {
  sess.events = sess.events || [];
  if (sess.ended) return { type: 'invalid_state', reason: 'ended', ended: sess.ended };   // 11-05 시뮬 5차: 끝난(그만둠·멈춤) 세션은 다시 열지 않음
  if (pick.optionId === 'FX-MORE') pick = { more: true }; if (pick.optionId === 'FX-DK') pick = { dk: true }; if (pick.optionId === 'FX-STOP') pick = { stop: true };
  const fx = pick.more ? 'FX-MORE' : pick.stop ? 'FX-STOP' : pick.dk ? 'FX-DK' : (pick.other && !pick.matchedOptionId) ? 'FX-OTHER' : pick.multi ? 'FX-MULTI' : null;
  // 10-28 시뮬 #3: “다른 이유(직접 쓰기)”를 서버가 보기로 맞힌 것(matchedOptionId)은 지금 카드의 보기면 받음 — 보여 줬는지는 보지 않음
  const matched = pick.matchedOptionId && !pick.optionId && !pick.multi;
  if (matched) {   // 10-28 3차: 같은 장면 다른 카드의 보기면 그 카드로 옮겨 이어감(CR-12) · 다른 장면이면 거절
    const mo = data.options[pick.matchedOptionId];
    if (!mo || _code(mo.card) !== _code(sess.card_id)) return { type: 'invalid_option', card_id: sess.card_id, rejected: [pick.matchedOptionId] };
    if (mo.card !== sess.card_id) { sess.path.push({ card: sess.card_id, pick: 'JUMP', to: mo.card }); sess.card_id = mo.card; }
  }
  const chk = matched ? null : _checkShown(sess, [...(pick.multi || (fx ? [] : [pick.optionId || pick.matchedOptionId])), ...(fx && fx !== 'FX-STOP' ? [fx] : [])]);
  if (chk) return chk;
  if (pick.more) {   // 10-28 CSO 피드백 3: “다른 이유 더 보기” — 앞서 보인 보기를 빼고 다음 확률 순 3개 · 모름으로 세지 않음
    sess.denied = sess.denied || {}; sess.denied[sess.card_id] = [...new Set([...(sess.denied[sess.card_id] || []), ...((sess.shown || {})[sess.card_id] || []).filter(id => !id.startsWith('FX-'))])];
    sess.path.push({ card: sess.card_id, pick: 'FX-MORE' });
    if (!_remaining(sess, sess.card_id, states, ctx, data).length) return { type: 'card', card_id: sess.card_id, retry: true, no_more: true };
    return { type: 'card', card_id: sess.card_id, retry: true, more: true };
  }
  if (pick.stop) { _dropPending(sess, states); _branchStop(sess, states, userId); return _end(sess, 'user_stop'); }                         // CR-07 ④ 대기 점수 버림
  if (pick.dk) {   // 10-28 3차: 모름은 카드 한 장으로 세지 않음 · 1단도 한 번은 다른 보기로 다시 물음 · 남는 보기가 2개 미만이면 다시 묻지 않고 멈춤
    sess.dk += 1; sess.path.push({ card: sess.card_id, pick: 'FX-DK' });
    sess.denied = sess.denied || {}; sess.denied[sess.card_id] = [...new Set([...(sess.denied[sess.card_id] || []), ...((sess.shown || {})[sess.card_id] || []).filter(id => !id.startsWith('FX-'))])];
    if (sess.dk >= MAX_DK || _remaining(sess, sess.card_id, states, ctx, data).length < 2) { _branchStop(sess, states, userId); return _end(sess, 'dont_know', '모름'); }
    return { type: 'card', card_id: sess.card_id, retry: true, exclude_shown: true };
  }
  if (pick.other && !pick.matchedOptionId) {   // 10-28 3차: 맞는 보기가 없는 말 한 번은 같은 카드 유지, 두 번째에 멈춤(CR-07 ④)
    sess.unmatched = (sess.unmatched || 0) + 1; sess.path.push({ card: sess.card_id, pick: 'FX-OTHER', text: pick.other });
    if (sess.unmatched >= 2) { _branchStop(sess, states, userId); return _end(sess, 'choice_unmatched'); }
    return { type: 'card', card_id: sess.card_id, retry: true, unmatched: true };
  }
  sess.cards_shown += 1;
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
  // 10-28 CSO 피드백 3(B안): 1단 마음 갈래 → 갈래 근거(점수 아님)
  if (data.cards[next.card]?.level === 1 && next.kind === '마음' && next.next_card && !sess.branch)
    sess.branch = { option: next.id, roots: [...new Set(next.rank_roots || [])] };
  if (!next.next_card && sess.branch) _branchEnd(sess, states, userId, next);
  if (next.next_card && sess.cards_shown < MAX_CARDS) { sess.card_id = next.next_card; return { type: 'card', card_id: next.next_card }; }
  if (next.kind !== '마음' && !next.core_thought) return _end(sess, 'no_root', next.kind, next);
  if (next.core_thought) {
    // 10-28 CSO 피드백 2: 이미 확인된 뿌리이거나 점수 뿌리가 없는 끝 보기면 확인 카드를 건너뜀
    const scored = next.roots.filter(r => (r.link || 'support') !== 'goal');
    if (!next.roots.length) return _end(sess, 'no_root_confirm_skipped', next.kind, next);
    if (scored.length && scored.every(r => states[r.root]?.status === 'confirmed')) return _end(sess, 'already_confirmed', null, next);
    return { type: 'confirm', option_id: next.id, text: data.confirm.template.replace('{기저생각}', next.core_thought), options: confirmOptions(sess, data) };
  }
  return _end(sess, 'max_cards', null, next);
}

/** 갈래 근거 ②: 끝에서 점수 받은 뿌리가 1단 갈래 뿌리면 +0.5 더(같은 보기 사건으로 남겨 정정·CF-D 때 함께 되돌림) */
function _branchEnd(sess, states, userId, o) {
  const br = new Set(sess.branch.roots), ev = sess.evidence.find(e => e.option === o.id && e.validity === 'active');
  for (const g of (ev?.gained || [])) if (br.has(g.root) && !sess.branch_paid) {
    const st = _st(states, userId, g.root), eid = `${o.card}:${o.id}:${sess.chat_id}:${g.root}:branch`;
    RS.putEvent(st, { event_id: eid, source: 'chat', points: CFG.branchBoost, claim: `branch:${sess.branch.option}`, chat_id: sess.chat_id, meta: { option: o.id, card: o.card, branch: sess.branch.option } }, sess.events);
    ev.gained.push({ root: g.root, points: CFG.branchBoost, eid }); sess.branch_paid = true;
  }
}
/** 갈래 근거 ③: 끝까지 못 가고 멈추면(뿌리 점수 없이) 갈래 뿌리 중 확률 1위 하나에 0.5 */
function _branchStop(sess, states, userId) {
  if (!sess.branch || sess.branch_paid || sess.evidence.some(e => e.validity === 'active' && (e.gained || []).length)) return;
  const best = [...sess.branch.roots].sort((a, b) => prior(states[b]) - prior(states[a]))[0]; if (!best) return;
  const st = _st(states, userId, best), eid = `${sess.branch.option}:${sess.chat_id}:${best}:branch-stop`;
  RS.putEvent(st, { event_id: eid, source: 'chat', points: CFG.branchBoost, claim: `branch:${sess.branch.option}`, chat_id: sess.chat_id, meta: { option: sess.branch.option, branch: sess.branch.option, stop: true } }, sess.events);
  sess.branch_paid = true;
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
  if (!o || (sess.ended && !(sess.ended === 'confirmed_scope_pending'))) return { type: 'invalid_state', reason: !o ? 'no_option' : 'ended' };   // 10-28 시뮬 #4: 빈 세션·끝난 세션 확인
  if (cfId === 'CF-D') cfId = 'CF-3';   // 10-28: 별로 아니에요 = 예전 CF-3
  if (cfId === 'CF-C') { _dropPending(sess, states); return { ..._end(sess, 'confirm_weak', null, o), fit: 'C' }; }   // 조금은 비슷해요 — 점수 그대로
  if (cfId === 'CF-B') {   // 꽤 비슷해요 — 주 뿌리 +0.5(확인 아님)
    _dropPending(sess, states);
    const main = o.roots.filter(r => (r.link || 'support') !== 'goal').sort((a, b) => b.points - a.points)[0];
    if (main) { const st = states[main.root] || (states[main.root] = RS.newRootState(sess.user_id || 'u', main.root));
      RS.putEvent(st, { event_id: `${o.card}:${o.id}:${sess.chat_id}:CF-B`, source: 'chat', points: 0.5, claim: (o.claim_id || o.meaning_key) + ':fit-B', chat_id: sess.chat_id, at, meta: { option: o.id, fit: 'B' } }, sess.events); }
    return { ..._end(sess, 'confirm_partial', null, o), fit: 'B' };
  }
  if (cfId === 'CF-A') {   // 딱 내 마음이에요 — 확인(예전 CF-1과 같음) 뒤 범위 질문
    if (isDeficitOption(o, data)) {   // 11-04 CASE-03: 결핍층이면 확정 없이 추측 기록만 · 범위 질문은 그대로(서로 다른 장면 수를 셈)
      _dropPending(sess, states); const root = _deficitHint(sess, states, o, at, 'fit-A'); sess.ended = 'confirmed_scope_pending'; sess.deficit_root = root;
      return { type: 'confirm_scope', deficit_hypothesis: root, option_id: o.id, text: data.confirm_scope?.template || '다른 데서도 자주 그런 편이에요?', options: (data.confirm_scope?.options || []).map(x => ({ ...x, text: x.text.replace('{장면}', scenePlace(sess, data)) })), practice: o.practice || {} };
    }
    const r = confirmChoice(sess, states, 'CF-1', at, data); sess.ended = 'confirmed_scope_pending';
    return { type: 'confirm_scope', option_id: o.id, text: data.confirm_scope?.template || '다른 데서도 자주 그런 편이에요?', options: (data.confirm_scope?.options || []).map(x => ({ ...x, text: x.text.replace('{장면}', scenePlace(sess, data)) })), practice: r.practice };
  }
  if (cfId === 'CF-3') {
    _revert(sess, states, o.id); _dropPending(sess, states);
    const claim = o.claim_id || o.meaning_key;   // 10-28 3차: 같은 대화에서 같은 뜻으로 받은 대화 점수도 되돌리고, 그 대화 동안 분류 후보에서 뺌(sess.rejected_claims → ctx.excludeClaims)
    for (const st of Object.values(states)) RS.supersedeWhere(st, e => e.source === 'chat' && e.chat_id === sess.chat_id && e.claim === claim && (e.kind ?? 'evidence') === 'evidence', sess.events, 'corrected');
    sess.rejected_claims = [...new Set([...(sess.rejected_claims || []), claim])];
    return { ..._end(sess, 'confirm_rejected'), option_id: o.id, rejected_claim: claim };
  }   // 10-27 시뮬 #5: 아니라고 한 보기의 실천은 돌려주지 않음
  if ((cfId === 'CF-1' || cfId === 'CF-2') && isDeficitOption(o, data) && !sess.deficit_root) { _dropPending(sess, states); const root = _deficitHint(sess, states, o, at, cfId); return { ..._end(sess, 'deficit_hypothesis', null, o), deficit_hypothesis: root, generalized_hint: cfId === 'CF-2' }; }
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
  // 10-28 3차: 새 보기를 먼저 검사(같은 장면 보기만) — 통과할 때만 되돌림 · 다른 카드 보기면 그 카드로 옮김 · 확인 뒤 정정도 새 확인 가능
  const nid = newPick && (newPick.optionId || newPick.matchedOptionId), no = nid && data.options[nid];
  if (newPick && nid && (!no || _code(no.card) !== _code(sess.card_id || sess.started_card_id))) return { type: 'invalid_option', card_id: sess.card_id, rejected: [nid] };
  _revert(sess, states, wrongOptionId);
  for (const st of Object.values(states)) {
    const n = RS.supersedeWhere(st, e => (e.kind === 'status' || e.kind === 'goal_confirm') && e.scope?.option_id === wrongOptionId && e.scope?.chat_id === sess.chat_id, sess.events, 'corrected');
    if (n) st.answer = 'corrected';
  }
  if (!newPick) return _end(sess, 'corrected');
  sess.cards_shown = Math.max(0, sess.cards_shown - 1);
  sess.ended = null; sess.no_root_label = null;
  if (no && no.card !== sess.card_id) { sess.path.push({ card: sess.card_id, pick: 'CORRECT-JUMP', to: no.card }); sess.card_id = no.card; }
  return recordChoice(sess, states, userId, { optionId: nid, ...newPick, matchedOptionId: undefined }, { ...ctx }, data);
}

function _end(sess, reason, label = null, opt = null) {
  sess.ended = reason; sess.no_root_label = label;
  return { type: 'stop', reason, label, option_id: opt?.id || null, practice: opt?.practice || {}, pending_branch: sess.pending_branch };
}

/** 10-27 시뮬 #4: 확인 카드 CF-1 “{장면} 특히” — 장면 자리 말을 끼움 */
export function scenePlace(sess, data = DATA) {
  const code = c => String(c || '').split('-')[1];   // 10-28 시뮬 #7: 다시 연 갈래(3단에서 시작)도 카드 코드로 장면을 찾음
  const sc = (data.scenes || []).find(x => x.first_card === sess.started_card_id) || (data.scenes || []).find(x => code(x.first_card) === code(sess.started_card_id));
  return sc?.confirm_place || '이럴 때';
}
export function confirmOptions(sess, data = DATA) {
  const place = scenePlace(sess, data);
  return data.confirm.options.map(x => ({ ...x, text: x.text.replace('{장면}', place) }));
}

/** 10-28 3차: 확인 범위만 고침 — “다른 데선 안 그래요”(CF-2 → CF-1): 일반화(+1.0)만 되돌리고 확인은 그대로 */
export function rescopeConfirm(sess, states, to = 'CF-1', data = DATA) {
  sess.events = sess.events || [];
  const o = data.options[sess.last_option]; if (!o || to !== 'CF-1') return { type: 'invalid_state' };
  let n = 0; for (const st of Object.values(states)) n += RS.supersedeWhere(st, e => e.event_id === `${o.card}:${o.id}:${sess.chat_id}:CF-2`, sess.events, 'rescoped') || 0;
  sess.generalized = false; for (const st of Object.values(states)) if (st.generalized && n) st.generalized = false;
  return { type: 'rescoped', option_id: o.id, undone: n };
}

/** 11-04 CASE-03: 결핍층 뿌리는 확인 카드로 확정하지 않음(추측만) — data.root_layers = {root: 층} */
function _mainRoot(o) { return o.roots.filter(r => (r.link || 'support') !== 'goal').sort((a, b) => b.points - a.points)[0]; }
export function isDeficitOption(o, data = DATA) { const m = o && _mainRoot(o); return !!(m && (data.root_layers || {})[m.root] === '결핍'); }
function _deficitHint(sess, states, o, at, tag) {
  const m = _mainRoot(o), st = states[m.root] || (states[m.root] = RS.newRootState(sess.user_id || 'u', m.root));
  RS.putEvent(st, { event_id: `${o.card}:${o.id}:${sess.chat_id}:deficit:${tag}`, source: 'chat', points: 0, claim: (o.claim_id || o.meaning_key) + ':deficit-hint', chat_id: sess.chat_id, at, meta: { option: o.id, deficit: true, scene: _code(sess.started_card_id), hint: tag } }, sess.events);
  return m.root;
}
/** 10-28 CSO 피드백 2: “딱 내 마음이에요” 뒤 범위 — CS-1 그 장면만(그대로) · CS-2 다른 데서도(+1.0 일반화) */
export function confirmScope(sess, states, csId, at, data = DATA) {
  sess.events = sess.events || [];
  const o = data.options[sess.last_option];
  if (!o || sess.ended !== 'confirmed_scope_pending') return { type: 'invalid_state' };
  if (sess.deficit_root) {   // 11-04 CASE-03: 결핍 추측 — 일반화 점수 없음, 다른 데서도 그렇다는 표시만
    if (csId === 'CS-2') _deficitHint(sess, states, o, at, 'generalized');
    const root = sess.deficit_root; sess.deficit_root = null;
    return { ..._end(sess, 'deficit_hypothesis', null, o), deficit_hypothesis: root, generalized_hint: csId === 'CS-2', route: csId === 'CS-1' ? 'environment' : null };
  }
  const main = o.roots.filter(r => (r.link || 'support') !== 'goal').sort((a, b) => b.points - a.points)[0];
  if (csId === 'CS-2' && main) { const st = states[main.root];
    const prev = (st.confirm_scope || []).find(x => x.option_id === o.id && x.chat_id === sess.chat_id) || { option_id: o.id, claim: o.core_thought, module: data.cards[o.card].module, chat_id: sess.chat_id, at };
    RS.recordAnswer(st, 'accepted', at, sess.chat_id, sess.events, { event_id: `${o.card}:${o.id}:${sess.chat_id}:status:${main.root}`, scope: { ...prev, generalized: true } });
    RS.putEvent(st, { event_id: `${o.card}:${o.id}:${sess.chat_id}:CF-2`, source: 'chat', points: 1.0, claim: (o.claim_id || o.meaning_key) + ':generalized', chat_id: sess.chat_id, at, meta: { option: o.id, generalized: true } }, sess.events); sess.generalized = true; }
  return { ..._end(sess, 'confirmed', null, o), route: csId === 'CS-1' ? 'environment' : 'pattern' };   // 11-04 CASE-09: 이 상황에서만 → 환경 쪽(대처 방법 과제)
}

/** 10-28 CSO 피드백 4: 첫 말이 막연할 때 장면 후보 — 온보딩 관심 영역(focus_domains)·아스트로 Q1 답으로 */
export function sceneCandidates(focusKeys = [], astroKeys = [], limit = 3, data = DATA) {
  const keys = [...focusKeys, ...astroKeys.map(k => 'astro:' + k)];
  const score = sc => keys.reduce((a, k, i) => a + ((sc.focus || []).includes(k) ? (k.startsWith('astro:') ? 0.5 : 1) / (1 + i * 0.2) : 0), 0);
  return (data.scenes || []).map(sc => ({ key: sc.key, name: sc.name, s: score(sc) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit);
}

/** 10-28 CSO 피드백 4: 장면 시작 — 1단 마음 갈래 확률이 충분히 높으면 1단을 건너뛰고 “혹시 ○○ 쪽일까요?”로 시작 */
export function startScene(chatId, sceneKey, states = {}, ctx = {}, data = DATA) {
  const sc = (data.scenes || []).find(x => x.key === sceneKey); if (!sc) return { type: 'invalid_state' };
  const sess = newChoiceSession(chatId, sc.first_card);
  const opts = Object.values(data.options).filter(o => o.card === sc.first_card && o.kind === '마음' && o.next_card && (!o.gate || [].concat(o.gate).some(g => (ctx.mentioned || []).includes(g))));
  const pr = opts.map(o => ({ o, p: o.rank_roots.reduce((a, r) => a + Math.min(prior(states[r]), CAP_PER_ROOT), 0) })).sort((a, b) => b.p - a.p);
  if (pr[0] && pr[0].p >= CFG.skipMin && pr[0].p >= CFG.skipRatio * (pr[1]?.p || 0)) {
    sess.skip_offer = pr[0].o.id;
    return { sess, out: { type: 'skip_confirm', option_id: pr[0].o.id, text: `혹시 “${pr[0].o.text}” 쪽일까요?`, options: [{ id: 'SK-YES', text: '네, 그쪽이에요' }, { id: 'SK-NO', text: '아니요' }] } };
  }
  return { sess, out: { type: 'card', card_id: sc.first_card } };
}
/** 건너뛰기 답: 네 → 1단 보기를 고른 것과 같게(갈래 근거) · 아니요 → 그 보기는 빼고 보통 1단 */
export function answerSkip(sess, states, userId, answer, ctx = {}, data = DATA) {
  const id = sess.skip_offer; sess.skip_offer = null; if (!id) return { type: 'invalid_state' };
  sess.shown = sess.shown || {}; sess.shown[sess.card_id] = [...new Set([...(sess.shown[sess.card_id] || []), id])];
  if (answer === 'SK-YES') return recordChoice(sess, states, userId, { optionId: id }, ctx, data);
  sess.denied = sess.denied || {}; sess.denied[sess.card_id] = [...new Set([...(sess.denied[sess.card_id] || []), id])];
  return { type: 'card', card_id: sess.card_id };
}
