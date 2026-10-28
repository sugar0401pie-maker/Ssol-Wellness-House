// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v2.7/ssol_root_state_v1.5.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 공통 뿌리(root) 상태 엔진 v0.7 (2026-10-20 · 심리테스트를 검사별(instrument)로 분리 — 디저트 테스트 dessert_v2) — ESM
 *
 * v0.5 핵심: 근거 장부(sw_evidence_events)가 유일한 원본(개발 검토 A-2 A안 · A-3)
 *   - 점수·출처·chat_keys·test_points·astro_*_points·goal·goal_confirmed·confirm_scope·domain_limited·generalized·human_rejected_at
 *     은 저장하지 않고 장부의 "활성 사건"에서 매번 다시 만든다(_derive). DB에서 다시 읽을 때는 hydrate(userId, events, rows).
 *   - 상태를 바꾸는 모든 함수는 사건(op)을 sink 배열에 넣는다 → 서버가 DB 함수로 기록:
 *       op 'apply'        → public.sw_apply_evidence(...)
 *       op 'set_status'   → public.sw_set_root_status(...)   (확인·거절도 장부 1행)
 *       op 'goal_confirm' → public.sw_set_root_status(... kind='goal_confirm')
 *       op 'supersede'    → public.sw_supersede_event(user, event_id, by)
 *   - 재검사·재반영(심리테스트·점성술·휴먼 세션·온보딩)은 같은 출처의 이전 사건을 supersede한 뒤 새 사건을 기록(출처별 한 벌만 활성)
 *   - 같은 내용을 다시 보내면 새 사건을 만들지 않음(멱등)
 *
 * 그 밖: 🛡 ① 누적 턴 · ③ 넘김 · ② 위기 판단은 lib/safety 결과만 받음 · 실천 뿌리 가산(기본 꺼짐) · 아스트로 용어 검사(A-4)
 * 원본 데이터는 운영 DB 표에서 읽어 setData()로 넣음. 이 모듈은 파일을 읽지 않음(JSON 기본값은 시험 코드가 읽어 setData로 넣음).
 * ※ turnCheckFrom·minEscalate·② 단계 기준은 전문위원 확정 전 임시값
 */
export const CFG = {
  turnCheckFrom: 7,
  minEscalate: 2,
  scoreLikely: 3,
  minSourcesLikely: 2,
  noAnswerRetryDays: 14,
  legacySafetyLevels: false, // true면 엔진이 S 코드로 단계를 정함(시험용) — 운영은 false: lib/safety 결과만 씀
  enableRootBoost: false,    // 기본 꺼짐
  enableChoiceCards: false,  // 기본 꺼짐(운영은 켬 — CSO 10-27 A4)
  chatClassifierScoring: true,   // CSO 10-27 A4: 자유 대화 분류기 점수도 켬(그림자 모드 아님) — 운영 스위치 기본값 참고
  signalLinksLive: true,         // CSO 10-27 결정 15: 판별 문장 연결(semantic·after_gate) 지금 점수에 씀
  requireApproved: false,        // CSO 10-27 결정 12(RC-13): 검수 게이트 끔 — 이번 달 새 실천 자동 노출
  motiveLive: true,              // CSO 10-27: 동기 위치(MV-01~05)·갈래(RC-21) 표시를 검수 전이라도 운영에 씀 — 나중에 고침
  level2: {
    'S1-a': 'high', 'S1-b': 'urgent', 'S1-c': 'urgent', 'S1-d': 'urgent', 'S1-e': 'high',
    'S2-a': 'high', 'S2-b': 'high', 'S2-c': 'caution',
    'S3-a': 'caution', 'S3-b': 'caution', 'S3-c': 'caution', 'S3-d': 'caution', 'S3-e': 'high',
    'S4-a': 'high', 'S4-b': 'high', 'S4-c': 'caution', 'S4-d': 'high',
    'S5-a': 'caution', 'S5-b': 'high',
  },
};
const RANK = { caution: 1, high: 2, urgent: 3 };
export const SAFE_RULE = { S1: 'SAFE-013', S2: 'SAFE-013|SAFE-009', S3: 'SAFE-009', S4: 'SAFE-018(신규)', S5: 'SAFE-019(신규)', S6: 'SAFE-020(신규)', S7: 'SAFE-021(신규)' };   // 참고표 — 판단은 lib/safety
export const REFLECTION_MAP = { agree: 'accepted', possible_yes: 'partial', partial: 'partial', disagree: 'rejected', unsure: 'shown_no_answer', topic_shift: 'shown_no_answer' };
export function mapReflection(label) { return REFLECTION_MAP[label] || 'shown_no_answer'; }

// DB 값 제한(B-3)과 같은 목록
export const SOURCE_TYPES = ['chat', 'test', 'human', 'onboarding', 'astro_q', 'astro_profile'];
export const STATUSES = ['candidate', 'likely', 'confirmed', 'rejected'];
export const LINKS = ['support', 'conditional', 'goal'];
export const POLARITIES = ['present', 'absent', 'desired'];
export const EVENT_KINDS = ['evidence', 'status', 'goal_confirm'];

// sw_user_root_state에 칸이 있는 필드(장부에서 만들지 않는 것) — hydrate 때 행에서 그대로 읽음
export const ROW_FIELDS = ['use_direction', 'use_direction_at', 'onboarding_from', 'combo_bonus', 'current_member', 'ladder_step', 'current_node', 'answer', 'answered_at', 'answered_chat_id',
  'safety_group', 'turns_total', 'turns_since_improve', 'last_improve_at', 'last_improve_chat_id', 'last_improve_text', 'escalate_seen', 'escalated_at',
  'escalated_reason', 'caution_hold', 'safety2_level', 'safety2_signals', 'safety2_at', 'crisis_history_ref', 'human_suggested_at', 'human_suggested_chat_id',
  'human_declined_at', 'human_phrase_last', 'updated_at'];

export function newRootState(userId, rootId) {
  return {
    user_id: userId, root_id: rootId,
    status: 'candidate', score: 0, sources: [],
    onboarding_cue: 0, onboarding_from: null, combo_bonus: 0,
    current_member: null, ladder_step: 0, current_node: null,
    answer: null, answered_at: null, answered_chat_id: null,
    safety_group: null,
    turns_total: 0, turns_since_improve: 0,
    last_improve_at: null, last_improve_chat_id: null, last_improve_text: null,
    escalate_seen: {},
    escalated_at: null, escalated_reason: null,
    caution_hold: false,
    safety2_level: null, safety2_signals: [], safety2_at: null, crisis_history_ref: null,
    human_suggested_at: null, human_suggested_chat_id: null, human_declined_at: null, human_phrase_last: null,
    updated_at: null,
    // ↓ 장부에서 만드는 값(저장 안 함)
    chat_keys: {}, test_points: 0, astro_q_points: 0, astro_profile_points: 0, human_points: 0,
    goal: [], goal_confirmed: false, goal_scope: [], confirm_scope: [], domain_limited: [], generalized: false, human_rejected_at: null,
    ledger: [],
  };
}

/* ───────── 장부 ───────── */
const _r = x => Math.round(x * 1e6) / 1e6;
const _now = () => new Date().toISOString();
function _ledger(st) { return st.ledger || (st.ledger = []); }
function _same(a, b) {
  return a.kind === b.kind && a.source === b.source && _r(a.points) === _r(b.points) && a.link === b.link && a.polarity === b.polarity
    && (a.status || null) === (b.status || null) && _r(a.meta?.goal_points || 0) === _r(b.meta?.goal_points || 0);
}
function _uid(st, base) {
  const L = _ledger(st); if (!L.some(e => e.event_id === base)) return base;
  let k = 1; while (L.some(e => e.event_id === `${base}:r${k}`)) k++; return `${base}:r${k}`;
}
function _norm(st, ev) {
  const kind = ev.kind || 'evidence', link = ev.link || 'support';
  const points = kind === 'evidence' && link === 'support' ? (ev.points || 0) : 0;            // 조건부·목표·상태 사건은 0점
  return { kind, source: ev.source, points, link, polarity: ev.polarity || 'present', claim: ev.claim ?? null,
    status: kind === 'status' ? ev.status : null, scope: ev.scope ?? null, chat_id: ev.chat_id ?? null, at: ev.at || _now(),
    meta: { ...(ev.meta || {}) } };
}
/** 장부 행 → 서버로 보낼 op(DB 열 이름 그대로) */
function _op(st, e) {
  const op = e.kind === 'status' ? 'set_status' : e.kind === 'goal_confirm' ? 'goal_confirm' : 'apply';
  return { op, event_id: e.event_id, user_id: st.user_id, root_id: st.root_id, event_kind: e.kind, source_type: e.source, points: e.points,
    link: e.link, polarity: e.polarity, claim_id: e.claim, status_to: e.status, confirmation_scope: e.scope, chat_id: e.chat_id, observed_at: e.at,
    meta: { ...e.meta, base: e.base } };
}
/**
 * 사건 하나 넣기. ev = { event_id | base, kind, source, points, link, polarity, claim, status, scope, chat_id, at, meta }
 * - 같은 base의 활성 사건이 같은 내용이면 아무것도 안 함(멱등) → null
 * - 같은 base의 활성 사건이 다른 내용이면 그것을 supersede하고 새 id(:r1…)로 기록
 */
export function putEvent(st, ev, sink) {
  if (!SOURCE_TYPES.includes(ev.source)) throw new Error(`source_type 값 오류: ${ev.source}`);
  const base = ev.event_id || ev.base, n = _norm(st, ev), L = _ledger(st);
  const act = L.find(e => e.validity === 'active' && e.base === base);
  if (act && _same(act, n)) return null;
  if (act) _supersedeRow(st, act, sink, null);
  const e = { event_id: _uid(st, base), base, validity: 'active', ...n };
  L.push(e); _derive(st);
  if (sink) sink.push(_op(st, e));
  return e;
}
function _supersedeRow(st, e, sink, by) {
  if (e.validity !== 'active') return false;
  e.validity = 'superseded'; e.superseded_by = by;
  if (sink) sink.push({ op: 'supersede', user_id: st.user_id, root_id: st.root_id, event_id: e.event_id, by });
  return true;
}
/** 사건 id로 정정(supersede) */
export function supersedeEvent(st, eventId, sink, by = null) {
  const e = _ledger(st).find(x => x.event_id === eventId);
  if (!e || !_supersedeRow(st, e, sink, by)) return false;
  _derive(st); return true;
}
/** 조건에 맞는 활성 사건을 모두 정정 */
export function supersedeWhere(st, pred, sink, by = null) {
  let n = 0; for (const e of _ledger(st)) if (e.validity === 'active' && pred(e) && _supersedeRow(st, e, sink, by)) n++;
  if (n) _derive(st); return n;
}
/** 출처 한 벌 바꾸기: match에 맞는 활성 사건 중 items에 같은 base·같은 내용이 있으면 그대로, 나머지는 supersede → 새 항목 기록 */
function _replaceSource(states, userId, match, items, sink) {
  const want = new Map(items.map(i => [i.base, i]));
  for (const st of Object.values(states)) {
    let changed = false;
    for (const e of _ledger(st)) {
      if (e.validity !== 'active' || !match(e)) continue;
      const w = want.get(e.base);
      if (w && w.root === st.root_id && _same(e, _norm(st, w))) { want.delete(e.base); continue; }
      changed = _supersedeRow(st, e, sink, null) || changed;
    }
    if (changed) _derive(st);
  }
  for (const i of want.values()) putEvent(states[i.root] || (states[i.root] = newRootState(userId, i.root)), i, sink);
}

/** 장부의 활성 사건 → 파생 값 */
function _derive(st) {
  const A = _ledger(st).filter(e => e.validity === 'active');
  const ev = A.filter(e => e.kind === 'evidence');
  const sum = f => _r(ev.filter(f).reduce((a, e) => a + e.points, 0));
  st.score = sum(() => true);
  st.sources = [...new Set(ev.filter(e => e.points !== 0).map(e => e.source))];
  st.chat_keys = {};
  for (const e of ev) if (e.source === 'chat' && e.meta?.key) st.chat_keys[e.meta.key] = _r((st.chat_keys[e.meta.key] || 0) + e.points);
  st.test_points = sum(e => e.source === 'test'); st.astro_q_points = sum(e => e.source === 'astro_q');
  st.astro_profile_points = sum(e => e.source === 'astro_profile'); st.human_points = sum(e => e.source === 'human');
  const onb = ev.filter(e => e.source === 'onboarding' && e.points > 0).sort((a, b) => b.points - a.points)[0];
  st.onboarding_cue = onb ? onb.points : 0; st.onboarding_from = onb ? (onb.meta?.from ?? null) : (st.onboarding_from ?? null);
  st.goal = A.filter(e => e.kind === 'evidence' && e.link === 'goal').map(e => ({ polarity: e.polarity, source: e.source, from: e.meta?.from ?? null,
    option: e.meta?.option ?? null, chat_id: e.chat_id, points: e.meta?.goal_points ?? 0, cues: e.meta?.cues, event_id: e.event_id }));
  const gc = A.filter(e => e.kind === 'goal_confirm');
  st.goal_confirmed = gc.length > 0; st.goal_scope = gc.map(e => e.scope).filter(Boolean);
  const S = A.filter(e => e.kind === 'status');
  st.confirm_scope = S.filter(e => e.status === 'confirmed' && e.scope).map(e => e.scope);
  st.generalized = st.confirm_scope.some(s => s.generalized);
  st.domain_limited = st.confirm_scope.filter(s => !s.generalized && s.module).map(s => s.module);
  const hr = S.filter(e => e.source === 'human' && e.status === 'rejected').pop();
  st.human_rejected_at = hr ? hr.at : null;
  const last = S[S.length - 1];
  if (last && (last.status === 'confirmed' || last.status === 'rejected')) st.status = last.status;
  else {
    const fam = new Set(st.sources.map(x => x.startsWith('astro') ? 'astro' : x));   // 아스트로 Q·성향 진술은 출처 1곳(AR-03)
    st.status = (st.score >= CFG.scoreLikely && fam.size >= CFG.minSourcesLikely) ? 'likely' : 'candidate';
  }
  return st;
}
export const refreshStatus = st => _derive(st);

/**
 * DB에서 다시 읽기(A-2 완료 기준): events = sw_evidence_events 행(이 사용자 전체 · seq 순) · rows = sw_user_root_state 행
 * 행의 칸(ROW_FIELDS)은 그대로, 나머지 값은 장부에서 다시 만듦. 행의 score·status·sources는 캐시라 읽지 않음.
 */
export function hydrate(userId, events = [], rows = []) {
  const states = {};
  for (const r of rows) { const st = newRootState(userId, r.root_id); for (const k of ROW_FIELDS) if (r[k] !== undefined && r[k] !== null) st[k] = r[k]; states[r.root_id] = st; }
  const evs = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  for (const x of evs) {
    const st = states[x.root_id] || (states[x.root_id] = newRootState(userId, x.root_id));
    const meta = typeof x.meta === 'string' ? JSON.parse(x.meta) : (x.meta || {});
    _ledger(st).push({ event_id: x.event_id, base: meta.base || x.event_id, validity: x.validity || 'active', kind: x.event_kind || 'evidence',
      source: x.source_type, points: Number(x.points) || 0, link: x.link || 'support', polarity: x.polarity || 'present', claim: x.claim_id ?? null,
      status: x.status_to ?? null, scope: typeof x.confirmation_scope === 'string' ? JSON.parse(x.confirmation_scope) : (x.confirmation_scope ?? null),
      chat_id: x.chat_id ?? meta.chat_ref ?? null, at: x.observed_at, meta });   // chat_id가 uuid가 아니면 DB는 meta.chat_ref에 둠
  }
  for (const st of Object.values(states)) _derive(st);
  return states;
}
/** 저장용: 사용자×뿌리 행(캐시 값 포함). 장부 사건은 sink의 op로 따로 기록 */
export function toRow(st) {
  const r = { user_id: st.user_id, root_id: st.root_id, status: st.status, score: st.score, sources: st.sources, onboarding_cue: st.onboarding_cue };
  for (const k of ROW_FIELDS) r[k] = st[k];
  return r;
}

/* ───────── 근거 넣기 ───────── */
/** 온보딩 단서: 같은 뿌리에서 가장 큰 값 하나만 활성(RR-02). 자원 뿌리의 부족·바람(LK-03)은 점수 없이 목표 사건 */
let NODE_POLARITY = {};
export function applyOnboardingCue(st, hypId, cue, sink) {
  const pol = NODE_POLARITY[hypId];
  if (pol === 'absent' || pol === 'desired') {
    putEvent(st, { base: `onb:${st.root_id}:${hypId}:goal`, source: 'onboarding', link: 'goal', polarity: pol, points: 0, meta: { from: hypId, goal_points: cue } }, sink);
    return st;
  }
  if (cue > st.onboarding_cue) {
    supersedeWhere(st, e => e.kind === 'evidence' && e.source === 'onboarding' && e.link === 'support', sink);
    putEvent(st, { base: `onb:${st.root_id}:${hypId}`, source: 'onboarding', points: cue, meta: { from: hypId } }, sink);
  }
  return st;
}
/**
 * 온보딩 단서 한 벌 반영(v0.6 · OB-01~05): ssol_onboarding_scoring.onboardingRootCues() 결과를 그대로 넣음
 * cues = [{ root, points, hyp, convergence, combo, strong, goal? }] — 이전 온보딩 사건은 같은 출처 한 벌로 대체(재계산·온보딩 수정 시)
 * 뿌리당 활성 온보딩 사건은 하나(RR-02). goal이 있으면 점수 없이 목표 사건(LK-03)
 */
export function applyOnboardingSet(states, userId, cues, sink = []) {
  const items = [];
  for (const c of cues || []) {
    if (c.goal) items.push({ base: `onb:${c.root}:${c.hyp}:goal`, root: c.root, source: 'onboarding', link: 'goal', polarity: c.goal, points: 0, meta: { from: c.hyp, goal_points: c.points } });
    else if (c.points > 0) items.push({ base: `onb:${c.root}`, root: c.root, source: 'onboarding', points: c.points, meta: { from: c.hyp, convergence: c.convergence || 0, combo: c.combo || null, strong: !!c.strong } });
  }
  _replaceSource(states, userId, e => e.source === 'onboarding', items, sink);
  return { events: sink };
}
/** 대화·테스트·휴먼 세션 근거 1건(일반용). opt = { event_id, claim, chat_id, at, meta } */
export function addEvidence(st, source, points, sink, opt = {}) {
  const base = opt.event_id || `${source}:${st.root_id}:${_ledger(st).length + 1}`;
  putEvent(st, { base, source, points, claim: opt.claim, chat_id: opt.chat_id, at: opt.at, meta: opt.meta }, sink);
  if (source === 'human' && points !== 0)                                                  // 0점은 상태 변화 없음
    putEvent(st, { base: `${base}:status`, kind: 'status', source: 'human', status: points > 0 ? 'confirmed' : 'rejected', at: opt.at }, sink);
  return st;
}
/** 확인 질문 답(뿌리 전체). accepted → confirmed · rejected → rejected 상태 사건. opt = { event_id, scope, source } */
export function recordAnswer(st, answer, at, chatId, sink, opt = {}) {
  st.answer = answer; st.answered_at = at; st.answered_chat_id = chatId;
  if (answer === 'accepted' || answer === 'rejected')
    putEvent(st, { base: opt.event_id || `ans:${st.root_id}:${chatId}:${answer}`, kind: 'status', source: opt.source || 'chat',
      status: answer === 'accepted' ? 'confirmed' : 'rejected', scope: opt.scope ?? null, chat_id: chatId, at }, sink);
  st.updated_at = at; return st;
}
/**
 * 발화 분류기 결과 반영(sw_claim_classifier.toEvents 출력) — 같은 의미(뿌리|claim)는 큰 값 하나만(CR-10, 대화를 넘어도)
 * op 'candidate'(0.5~0.7)는 장부에 넣지 않고 hints로 돌려줌(확인 질문·카드 후보)
 */
export function applyChatClaims(states, userId, events, sink) {
  const hints = [];
  for (const x of events || []) {
    if (x.op === 'candidate') { hints.push(x); continue; }
    const st = states[x.root_id] || (states[x.root_id] = newRootState(userId, x.root_id));
    const key = `${x.root_id}|${x.claim_id}`, link = x.link || 'support';
    const meta = { key, evidence: x.evidence, confidence: x.confidence, message_id: x.message_id };
    if (link !== 'support') { putEvent(st, { event_id: x.event_id, source: 'chat', link, polarity: x.polarity, points: 0, claim: x.claim_id, chat_id: x.chat_id, meta }, sink); continue; }
    const add = _r(Math.max(0, x.points - (st.chat_keys[key] || 0)));
    if (add > 0) putEvent(st, { event_id: x.event_id, source: 'chat', points: add, claim: x.claim_id, chat_id: x.chat_id, meta }, sink);
  }
  return { hints };
}

/* ───────── 🛡 ① 턴 기록 ───────── */
export function onTheoryTurn(st, turn) {
  const reasons = [];
  st.current_member = turn.member ?? st.current_member;
  st.current_node = turn.node ?? st.current_node;
  if (turn.safetyGroup) st.safety_group = turn.safetyGroup;
  if (turn.safetyResult && turn.safetyResult.hit) {                                       // ② 위기 판단은 lib/safety 한 곳 — 결과만 기록
    const r = turn.safetyResult;
    st.safety2_level = r.level; st.safety2_signals = r.signals || []; st.safety2_at = turn.at; st.updated_at = turn.at;
    return { state: st, decision: 'route_safety_2', level: r.level, reasons: r.signals || [], db_rules: r.rules || [], log: mkLog(st, turn, 'route_safety_2'), source: 'lib/safety' };
  }
  if (turn.safety2 && turn.safety2.length && !CFG.legacySafetyLevels)
    return { state: st, decision: 'route_safety_2', level: null, reasons: turn.safety2, db_rules: [], log: mkLog(st, turn, 'route_safety_2'), source: 'needs_lib_safety' };
  if (turn.safety2 && turn.safety2.length) {
    let lv = 'caution';
    for (const s of turn.safety2) if (RANK[CFG.level2[s]] > RANK[lv]) lv = CFG.level2[s];
    if (turn.safety2.filter(s => s.startsWith('S3-') && s !== 'S3-e').length >= 2 && RANK[lv] < RANK.high) lv = 'high';
    st.safety2_level = lv; st.safety2_signals = turn.safety2; st.safety2_at = turn.at; st.updated_at = turn.at;
    const rules = [...new Set(turn.safety2.map(x => SAFE_RULE[x.split('-')[0]]))];
    return { state: st, decision: 'route_safety_2', level: lv, reasons: turn.safety2, db_rules: rules, log: mkLog(st, turn, 'route_safety_2') };
  }
  st.turns_total += 1; st.turns_since_improve += 1;
  if (turn.improve) {
    st.turns_since_improve = 0; st.escalate_seen = {}; st.caution_hold = false;
    st.last_improve_at = turn.at; st.last_improve_chat_id = turn.chatId; st.last_improve_text = turn.improveText || null;
    reasons.push('improve_reset');
  }
  for (const e of turn.escalate || []) st.escalate_seen[e] = turn.at;
  let decision = 'continue';
  const n = Object.keys(st.escalate_seen).length;
  if (!turn.improve && st.turns_since_improve >= CFG.turnCheckFrom && n >= CFG.minEscalate) {
    decision = 'route_safety_3';
    st.escalated_at = turn.at; st.escalated_reason = Object.keys(st.escalate_seen).join(','); st.caution_hold = true;
    reasons.push(`turns_since_improve=${st.turns_since_improve}`, `escalate=${st.escalated_reason}`);
  }
  st.updated_at = turn.at;
  return { state: st, decision, reasons, log: mkLog(st, turn, decision) };
}
function mkLog(st, turn, decision) {
  return { user_id: st.user_id, root_id: st.root_id, chat_id: turn.chatId, at: turn.at, member: st.current_member, node: st.current_node,
    turns_total: st.turns_total, turns_since_improve: st.turns_since_improve, improve: !!turn.improve, escalate: turn.escalate || [], safety2: turn.safety2 || [], decision };
}
export function excludeExposureForRoot(st, practice) { return st.caution_hold && !!practice.exposure_step && (practice.roots || []).includes(st.root_id); }
export function canSuggestHuman(st, chatId, newNodeOrHeavier = false) {
  if (st.human_suggested_chat_id === chatId) return false;
  if (st.human_declined_at && !newNodeOrHeavier) return false;
  return true;
}
export function recordHumanSuggestion(st, chatId, at, phraseId, declined = false) {
  st.human_suggested_at = at; st.human_suggested_chat_id = chatId; st.human_phrase_last = phraseId;
  if (declined) st.human_declined_at = at;
  return st;
}

/* ───────── 속도·부담 거르기(③-10 몸 단계 · RC-19 나를 넘어서는 실천) — 뿌리 가산 스위치와 상관없이 항상 ─────────
 * 제1장 1-3-6 힘듦 3단계: 감정 = 재료(거르지 않음) · 몸 = 속도 낮춤(여기) · 일상 = 멈춤(lib/safety SAFE-009)
 * practice.step = 운영 실천표 단계('가볍게 시작'/'꾸준히 이어가기'/'장기 습관·정체성으로') · practice.exposure_step = 불편 머무르기 단계 · practice.beyond_self = 나를 넘어서는 실천(sw_ob_practice_flags)
 */
export const BODY_ROOTS = ['ROOT-60'];                      // 잠·몸 리듬 무너짐(대화 근거로 유력 이상일 때)
export const TIRED_ROOTS = ['ROOT-04', 'ROOT-59', 'ROOT-84'];   // 소진·돌봄 지침·자기 돌봄 공백
const _upLikely = st => st && ['likely', 'confirmed'].includes(st.status);
/** 몸 단계인지: lib/safety가 몸 신호(B-a~c)를 줬거나, 몸 피로 뿌리가 대화 근거로 유력 이상 */
export function bodyHold(rootStates, ctx = {}) {
  if (ctx.safetyBody) return true;
  return BODY_ROOTS.some(r => _upLikely(rootStates[r]) && (rootStates[r].sources || []).includes('chat'));
}
export function pacingFilter(practice, rootStates, ctx = {}) {
  const body = ctx.bodyHold ?? bodyHold(rootStates, ctx);
  if (body && (practice.exposure_step || (practice.step && practice.step !== '가볍게 시작')))
    return { exclude: true, reasons: [`③-10 몸 단계 — 가볍게 시작만(${practice.exposure_step ? '불편 머무르기' : practice.step})`] };
  if (practice.beyond_self && !ctx.beyondSignal) {
    const tired = TIRED_ROOTS.filter(r => _upLikely(rootStates[r]));
    if (tired.length) return { exclude: true, reasons: [`RC-19 지친 상태(${tired.join('·')}) — 나를 넘어서는 실천은 요구하지 않음`] };
  }
  return { exclude: false, reasons: [] };
}

/* ───────── 실천 뿌리 가산(RC-02~16) — 기본 꺼짐 ───────── */
export function rootBoost(practice, rootStates, ctx = {}) {
  let boost = 0; const reasons = [];
  { const pf = pacingFilter(practice, rootStates, ctx); if (pf.exclude) return { boost: 0, exclude: true, reasons: pf.reasons }; }
  if (!(ctx.enabled ?? CFG.enableRootBoost)) return { boost: 0, exclude: false, reasons: ['disabled'] };
  if (ctx.requireApproved && practice.review_status && practice.review_status !== 'approved') return { boost: 0, exclude: true, reasons: [`RC-13 검수 전(${practice.review_status})`] };
  for (const need of practice.needs || []) if (ctx.known && ctx.known[need] !== true) return { boost: 0, exclude: true, reasons: [`RC-14 필수 조건 ${need} ${ctx.known[need] === false ? '없음' : '모름'}`] };   // 10-28 시뮬 #5: 없음(false)도 뺌
  for (const r of practice.roots || []) {
    const st = rootStates[r]; if (!st) continue;
    if (ctx.avoid && ctx.avoid.has(`${r}|${practice.id}`) && st.status !== 'rejected' && (st.score > 0 || st.status !== 'candidate')) return { boost: 0, exclude: true, reasons: [`RC-15 ${r} 맞지 않는 실천 — 사전 제외`] };
    if (st.goal_confirmed && ctx.goalPractices && ctx.goalPractices.has(`${r}|${practice.id}`)) { boost += 1; reasons.push(`LK-03 ${r} 확인된 목표 +1`); }
    if (st.status === 'rejected') { reasons.push(`RC-06 ${r} 거절됨`); continue; }
    const opp = ctx.opposite && ctx.opposite[r];
    if (opp && rootStates[opp] && rootStates[opp].status === 'confirmed' && st.status !== 'confirmed') { reasons.push(`RC-06 반대 짝 ${opp} 확인됨`); continue; }
    if (ctx.sensitiveRoots && ctx.sensitiveRoots.has(r) && !(ctx.userSaidSensitive && ctx.userSaidSensitive.has(r))) { reasons.push(`RC-10 ${r} 민감 — 대화에서 말한 적 없음`); continue; }
    if (ctx.eligibleCount && (ctx.eligibleCount[r] ?? 99) < 3) { reasons.push(`RC-08 ${r} 남은 실천 3개 미만`); continue; }
    if (st.caution_hold && practice.exposure_step) { reasons.push(`caution_hold ${r} — 불편 머무르기 제외 대상`); continue; }
    const v = st.status === 'confirmed' ? 2 : st.status === 'likely' ? 1 : 0;
    if (v) { boost += v; reasons.push(`${r} ${st.status} +${v}`); }
  }
  if (ctx.motivePosition && (practice.motive_fit || []).includes(ctx.motivePosition)) { boost += 0.5; reasons.push(`MV-03 동기 위치 ${ctx.motivePosition}에 맞는 실천 +0.5`); }
  if (ctx.parentOf) {
    for (const [child, par] of Object.entries(ctx.parentOf)) {
      const st = rootStates[child];
      if (!st || !['likely', 'confirmed'].includes(st.status)) continue;
      if (!(practice.roots || []).includes(par) || (practice.roots || []).includes(child)) continue;
      if ((ctx.eligibleCount?.[child] ?? 99) >= 3) continue;
      if (ctx.avoid && ctx.avoid.has(`${child}|${practice.id}`)) return { boost: 0, exclude: true, reasons: [`RC-15 RR-16 ${child} 맞지 않는 실천 — 사전 제외`] };
      boost += 1; reasons.push(`RR-16 ${child} 실천 얇음 → 상위 ${par} +1`);
    }
  }
  return { boost: Math.max(0, Math.min(2, boost)), exclude: false, reasons };
}

/* ───────── 심리테스트 → 뿌리 단서(TRR-01~21) ───────── */
const EMPTY_TBL = { bands: [], pairs: [], domains: {}, cues: [] };
export const DEFAULT_INSTRUMENT = 'dessert_v2';                       // 디저트 웰니스 유형 테스트 — 다른 검사는 표·조건을 따로 둠
let TEST_TBLS = { [DEFAULT_INSTRUMENT]: EMPTY_TBL };
let TEST_TBL = EMPTY_TBL;                                             // 계산 중인 검사의 표(scoreTestCues가 정함)
const _useTbl = inst => (TEST_TBL = TEST_TBLS[inst || DEFAULT_INSTRUMENT] || EMPTY_TBL);
const _r1 = x => Math.round(x * 10) / 10;
function _band(v) {
  if (v == null || Number.isNaN(v)) return null;
  const B = TEST_TBL.bands, last = B.length - 1;
  const b = B.find(([, lo, hi], i) => v >= lo && (v < hi || (i === last && v <= hi)));
  return b ? b[0] : null;
}
function _testCond(c, t) {
  if (c.unless_ctx && Object.entries(c.unless_ctx).every(([k, v]) => t.context?.[k] === v)) return false;   // TRR-22 연애 대표 뿌리: 연인 있으면 안 씀
  if (c.all) return c.all.every(x => _testCond(x, t));
  if (c.anyOf) return c.anyOf.some(x => _testCond(x, t));
  const f = c.factor != null ? t.factorScores?.[c.factor] : undefined;
  if (c.band) return f != null && c.band.includes(_band(f));
  if (c.rel_le != null || c.rel_ge != null) {
    const vals = Object.values(t.factorScores || {}); if (f == null || vals.length < 5) return false;
    const d = f - vals.reduce((a, b) => a + b, 0) / vals.length;
    return (c.rel_le == null || d <= c.rel_le) && (c.rel_ge == null || d >= c.rel_ge);
  }
  if (c.lowest_in) {
    const fs = (TEST_TBL.domains[c.lowest_in] || []).map(k => t.factorScores?.[k]).filter(v => v != null);
    return f != null && fs.length > 0 && f <= Math.min(...fs);
  }
  if (c.coping_sub) { const v = t.copingSub?.[c.coping_sub]; return v != null && (c.ge == null || v >= c.ge) && (c.le == null || v <= c.le); }
  if (c.type) return `${t.main_domain}-${t.coping}` === c.type;
  if (c.coping) return t.coping === c.coping;
  if (c.main_domain) return t.main_domain === c.main_domain;
  return false;
}
function _factorsIn(c, acc = []) { if (c.all) c.all.forEach(x => _factorsIn(x, acc)); else if (c.anyOf) c.anyOf.forEach(x => _factorsIn(x, acc)); else if (c.factor) acc.push(c); return acc; }
const _STEP = p => (p >= 1.5 ? 1.0 : p >= 1.0 ? 0.5 : 0);
const _EDGE = { VL: 1.9, L: 2.4, ML: 2.9, MH: 3.5, H: 4.0, VH: 4.5 };
function _adjust(c, t) {
  let p = c.points;
  if (c.source === 'band') { const fc = _factorsIn(c.cond)[0]; const v = t.factorScores?.[fc.factor]; const b = _band(v); if (b && _EDGE[b] != null && Math.abs(_r1(v) - _EDGE[b]) <= 0.1 + 1e-9) p = _STEP(p); }
  if (c.source === 'type') { const fc = _factorsIn(c.cond).find(x => x.lowest_in); if (fc) { const b = _band(t.factorScores?.[fc.factor]); if (b === 'M') p = _STEP(p); else if (['MH', 'H', 'VH'].includes(b)) p = 0; } }
  return p;
}
export function scoreTestCues(test, cues) {
  _useTbl(test?.instrument); cues = cues || TEST_TBL.cues;
  const hits = cues.filter(c => _testCond(c.cond, test)).map(c => ({ ...c, p: _adjust(c, test) })).filter(c => c.p > 0);
  const per = {};
  for (const c of hits) {
    const key = c.direction === 'goal' ? `${c.root_id}#goal` : c.root_id;
    const R = per[key] || (per[key] = { base: {}, rel: {}, extra: 0, add: 0, cues: [], dir: c.direction, entry: new Set() });
    R.cues.push(c.cue_id); (c.entry_hyps || []).forEach(h => R.entry.add(h));
    const fk = (_factorsIn(c.cond)[0] || {}).factor || c.cue_id;
    if (c.source === 'band') R.base[fk] = Math.max(R.base[fk] || 0, c.p);
    else if (c.source === 'relative') R.rel[fk] = Math.max(R.rel[fk] || 0, c.p);
    else if (c.source === 'profile' || c.source === 'type') R.extra = Math.max(R.extra, c.p);
    else R.add += c.p;
  }
  const out = {};
  for (const [root, R] of Object.entries(per)) {
    for (const fk of Object.keys(R.rel)) if (R.base[fk]) delete R.rel[fk];
    const base = [...Object.values(R.base), ...Object.values(R.rel)].reduce((a, b) => a + b, 0);
    let v = base && R.extra ? Math.max(base, R.extra) + 0.5 : Math.max(base, R.extra);
    v = Math.min(2.0, v + R.add);
    out[root] = { points: v, cues: R.cues, direction: R.dir, entry: [...R.entry], profile: R.extra > 0 };
  }
  for (const [a, b] of TEST_TBL.pairs || []) {
    const hitA = hits.some(c => c.root_id === a && c.source === 'profile'), hitB = hits.some(c => c.root_id === b && c.source === 'profile');
    if (hitA && !hitB && out[b]) out[b].points = Math.max(0, out[b].points - 0.5);
    if (hitB && !hitA && out[a]) out[a].points = Math.max(0, out[a].points - 0.5);
  }
  return out;
}
/**
 * 심리테스트 반영 — 재검사면 이전 테스트 사건을 모두 supersede하고 새로 기록(TRR-01 · A-3). 합 1.0 이상 상위 6개만 사다리 후보(TRR-17)
 * test = { test_id, factorScores, main_domain, coping, copingSub, at, context? }  (context = 온보딩 답 — TRR-22 relationship_status)
 * 반환 { entries, ladderCandidates, entryHyps, events }
 */
export function applyTestCues(states, userId, test, cues = null, sink = []) {
  if (!test || !test.factorScores || !Object.keys(test.factorScores).length) return { entries: [], ladderCandidates: [], entryHyps: [], skipped: 'no_factor_scores', events: sink };   // TRR-20
  const inst = test.instrument || DEFAULT_INSTRUMENT, tid = test.test_id || test.id || 'test', at = test.at, sc = scoreTestCues(test, cues), entries = [], items = [];
  for (const [key, r] of Object.entries(sc)) {
    if (r.points <= 0) continue;
    const root = key.replace('#goal', '');
    if (r.direction === 'goal') {
      items.push({ base: `test:${inst}:${tid}:${root}:goal`, root, source: 'test', link: 'goal', polarity: 'absent', points: 0, at, meta: { instrument: inst, test_id: tid, goal_points: r.points, cues: r.cues } });
      entries.push({ root, points: 0, goal: r.points, direction: 'goal', cues: r.cues, entry: r.entry }); continue;
    }
    items.push({ base: `test:${inst}:${tid}:${root}`, root, source: 'test', points: r.points, at, meta: { instrument: inst, test_id: tid, cues: r.cues, direction: r.direction } });
    entries.push({ root, points: r.points, direction: r.direction, cues: r.cues, entry: r.entry });
  }
  _replaceSource(states, userId, e => e.source === 'test' && (e.meta?.instrument || DEFAULT_INSTRUMENT) === inst, items, sink);   // 같은 검사의 이전 결과만 대체
  entries.sort((x, y) => y.points - x.points);
  const ladder = entries.filter(e => e.points >= 1.0 || e.goal >= 1.0).slice(0, 6);
  return { entries, ladderCandidates: ladder.map(e => e.root), entryHyps: [...new Set(ladder.flatMap(e => e.entry))], events: sink };
}

/* ───────── 휴먼 세션 판단(HSR-01~07, 근거 A) ─────────
 * session = { session_id, consent_ai_use, share_scope, judgments:[{root_id, judgment, child_root_id, user_agreed, note_to_ai, avoid_practices}], safety:{ai_caution} }
 * 같은 세션을 다시 반영하면 그 세션의 이전 사건을 대체(바뀐 판단만 새로 기록)
 */
export function applyHumanSession(states, userId, session, parentOf = {}, at = _now(), sink = []) {
  const out = { applied: [], userAvoid: new Set(), noteToAi: {}, events: sink };
  if (!session.consent_ai_use) return out;                                                  // HSR-02
  const sid = session.session_id || 'hs', items = [], get = id => states[id] || (states[id] = newRootState(userId, id));
  for (const j of session.judgments || []) {
    if (j.judgment === 'not_discussed') continue;
    const target = j.child_root_id || j.root_id, st = get(target), meta = { session_id: sid };
    if (j.judgment === 'confirmed') {
      items.push({ base: `hs:${sid}:${target}`, root: target, source: 'human', points: 3, at, meta });
      items.push({ base: `hs:${sid}:${target}:status`, root: target, kind: 'status', source: 'human', status: 'confirmed', at, meta });
    } else if (j.judgment === 'partial') items.push({ base: `hs:${sid}:${target}`, root: target, source: 'human', points: 2, at, meta });
    else if (j.judgment === 'rejected') items.push({ base: `hs:${sid}:${target}:status`, root: target, kind: 'status', source: 'human', status: 'rejected', at, meta });   // HSR-04
    if (j.child_root_id && j.judgment !== 'rejected') { const par = parentOf[j.child_root_id] || j.root_id; get(par); items.push({ base: `hs:${sid}:${par}:parent`, root: par, source: 'human', points: 1, at, meta: { ...meta, child: j.child_root_id } }); }
    if (j.user_agreed === 'yes' && j.judgment !== 'rejected') { st.answer = 'accepted'; st.answered_at = at; }
    if (session.share_scope === 'roots_and_note' && j.note_to_ai) out.noteToAi[target] = j.note_to_ai;   // HSR-05
    (j.avoid_practices || []).forEach(p => out.userAvoid.add(p));                                         // HSR-06
    st.updated_at = at; out.applied.push({ root: target, judgment: j.judgment });
  }
  _replaceSource(states, userId, e => e.source === 'human' && e.meta?.session_id === sid, items, sink);
  if (session.safety && ['no_exposure', 'avoid_topic'].includes(session.safety.ai_caution))             // HSR-07
    for (const a of out.applied) if (a.judgment !== 'rejected') states[a.root].caution_hold = true;
  return out;
}

/* ───────── 헷갈리는 뿌리 가르기 ───────── */
let DISC = [];
export function pickDiscriminator(states, askedGroups = new Set(), gap = 1.0) {
  const c = Object.values(states).filter(s => ['candidate', 'likely'].includes(s.status) && s.score > 0).sort((a, b) => b.score - a.score);
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    if (c[i].score - c[j].score > gap) break;
    const g = DISC.find(d => d.roots.includes(c[i].root_id) && d.roots.includes(c[j].root_id) && !askedGroups.has(d.group_id));
    if (g) return { group: g.group_id, ask: g.ask, options: g.options, roots: [c[i].root_id, c[j].root_id], default: g.default };
  }
  return null;
}

/* ───────── 아스트로 결과 → 쏘웰라(AR-01~12) ───────── */
let ASTRO_C = { q: {}, sign_element: {} };
let ASTRO_S = {};

/**
 * 채팅 출력 검사 — 점성술 말(AR-07 · 개발 검토 A-4). 걸리면 재생성.
 * (a) 서비스 이름을 먼저 지움 (b) 점성술 문맥에서만 걸림 (c) 일상어 "달(月)"·"역행하는"·"태양 같은"·"차트를"은 통과
 */
const SERVICE_NAMES = /쏘웰라|쏠\s*웰니스\s*하우스|쏠\s*점성술\s*하우스|쏠\s*하우스/g;
const SIGN = '(?:양|황소|쌍둥이|게|사자|처녀|천칭|전갈|사수|궁수|염소|물병|물고기)';
const PLANET = '(?:수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|키론)';
const ASTRO_TERMS = [
  ['점성술 낱말', /점성술|점성학|호로스코프|어센던트|네이탈|트랜짓|상승궁|하강궁/],
  ['별자리 이름', new RegExp(`(?<![가-힣])${SIGN}자리`)],
  ['태양·달·상승 + 궁/사인/별자리', /(태양|달|문|상승)\s*(궁|사인|별자리)/],
  ['태양·달 + 별자리 이름', new RegExp(`(태양|달)(이|은|는|의|가)?\\s*${SIGN}(자리)?(?![가-힣]{2})`)],
  ['행성 + 문맥', new RegExp(`(${PLANET}|행성)(이|의|가)?\\s*(역행|리턴|순행|사인|자리|궁|하우스|트랜짓|기운|영향|에너지|배치|각도|합|충)`)],
  ['먼 행성 이름', /천왕성|해왕성|명왕성|키론/],
  ['차트 문맥', /(출생|탄생|네이탈|천궁|별자리|점성)\s*(차트|도)|차트\s*(상|에서|를\s*보면)?\s*(태양|달|상승|금성|화성|수성|목성|토성|하우스)/],
  ['하우스 번호', /(\d{1,2}|[일이삼사오육칠팔구십]{1,2}|첫|첫\s*번째|\d{1,2}\s*번째)\s*하우스|하우스\s*(의\s*)?(주인|룰러|커스프)/],
  ['원소 기운', /(불|흙|물|공기|바람)\s*(의)?\s*(원소|기운|사인)|원소\s*(가|는|이)?\s*(불|흙|물|공기)/],
  ['리턴', /(토성|목성|태양|솔라|새턴)\s*리턴/],
  ['천정(MC)', /천정(?!부지)\s*(궁|자리|별자리|의|에)|\bMC\b/],
  ['내 별자리', /(내|제|당신의?|너의?|님의?|네|저의)\s*별자리|별자리\s*(운세|성향|궁합|특징|별로|상으로)/],
];
export function checkAstroTerms(text) {
  const t = String(text || '').replace(SERVICE_NAMES, ' ');
  return ASTRO_TERMS.filter(([, re]) => re.test(t)).map(([name]) => name);
}

function _astroKeys(h) {
  const c = h.chart_summary || {}, t = c.type || {}, el = ASTRO_C.sign_element || {}, keys = [];
  if (c.sun) keys.push('sun:' + c.sun);
  if (c.moon) keys.push('moon:' + c.moon);
  if (c.asc && h.user?.accuracy !== 'C') keys.push('asc:' + c.asc);
  if (t.competency && t.style) keys.push(`type:${t.competency}|${t.style}`, 'comp:' + t.competency, 'style:' + t.style);
  if (c.sun && c.moon && el[c.sun] && el[c.moon]) keys.push(`temper:${el[c.sun]}|${el[c.moon]}`);
  if (h.year_2026?.theme) keys.push('theme2026:' + h.year_2026.theme);
  for (const x of h.year_end?.cautions || []) keys.push('caution:' + x);
  return new Set(keys);
}
/**
 * 아스트로 결과 반영: 이전 아스트로 사건(astro_q·astro_profile)을 대체(AR-10 · A-3) — Q1~Q3(D) + 성향 진술(F+)
 * 반환 { entries, quotes, practices, answers, events }
 */
export function applyAstro(states, userId, h, sink = []) {
  const sid = h.source_id || 'astro', at = h.created_at, items = [], entries = [], used = {};
  const add = (root, pts, src, cap, from, grade, direction) => {
    const k = `${root}|${src}`, room = Math.max(0, cap - (used[k] || 0)), p = Math.min(pts, room); if (p <= 0) return 0;
    used[k] = (used[k] || 0) + p;
    items.push({ base: `astro:${sid}:${from}:${root}`, root, source: src, points: p, at, meta: { source_id: sid, from, grade } });
    entries.push({ root, points: p, from, grade, ...(direction ? { direction } : {}) }); return p;
  };
  const a = h.answers || {};
  for (const [q, val] of [['astro_q1', a.q1_domain], ['astro_q2', a.q2_word_2026], ['astro_q3', a.q3_wish_2027]]) {      // AR-01
    const opt = ASTRO_C.q?.[q]?.[val]; if (!opt) continue;
    for (const [root, w] of Object.entries(opt.roots)) add(root, w, 'astro_q', 2.0, `${q}:${val}`, 'D');
  }
  const keys = _astroKeys(h), quotes = [];
  for (const [uid, s] of Object.entries(ASTRO_S)) {                                                     // AR-02
    if (!keys.has(s.key)) continue;
    const isType = s.key.startsWith('type:') || s.key.startsWith('comp:') || s.key.startsWith('style:');
    const chosen = isType && (h.type_chosen ?? true), src = chosen ? 'astro_q' : 'astro_profile';   // CSO 10-27 D2: 유형 카드는 본인이 고름 → 칸이 없어도 직접 선택(D)
    for (const r of s.roots) add(r.root_id, r.points, src, chosen ? 2.0 : 1.0, uid, chosen ? 'D' : 'F+', r.direction);
    quotes.push({ unit_id: uid, quote: s.quote, check_q: s.check_q, roots: s.roots.map(r => r.root_id) });
  }
  _replaceSource(states, userId, e => e.source === 'astro_q' || e.source === 'astro_profile', items, sink);
  const practices = (h.practices || []).map(p => ({ id: p.ssol_id, name: p.name }));
  return { entries, quotes, practices, answers: a, events: sink };
}
/** AR-04: 인용한 리포트 문장에 공감 → 그 문장의 뿌리를 사용자 확인(B) */
export function astroQuoteAgreed(states, userId, unitId, at, chatId, sink) {
  const s = ASTRO_S[unitId]; if (!s) return [];
  return s.roots.filter(r => r.direction === 'cue' || r.direction === 'resource')
    .map(r => recordAnswer(states[r.root_id] || (states[r.root_id] = newRootState(userId, r.root_id)), 'accepted', at, chatId, sink, { event_id: `ans:${r.root_id}:${chatId}:astro:${unitId}` }).root_id);
}
export function pickAstroQuotes(states, quotes, n = 2) {
  const score = q => Math.max(0, ...q.roots.map(r => states[r]?.score || 0));
  return [...quotes].sort((x, y) => score(y) - score(x)).slice(0, n);
}
export function astroPracticeFollowup(h, state = {}) {
  if (state.astro_practice_asked) return null;
  const p = (h.practices || [])[0]; if (!p) return null;
  return { practice: p, greeting: 'GREET2_PRACTICE', markAsked: true };
}
export function astroSignals(h, at = h.created_at || _now()) {
  const a = h.answers || {}, t = h.chart_summary?.type || {}, out = [];
  const push = (slot, value) => value && out.push({ slot, value, source: 'astro', observed_at: at, ref: h.source_id || 'astro' });
  push('astro.q1', a.q1_domain); push('astro.q2', a.q2_word_2026); push('astro.q3', a.q3_wish_2027);
  push('astro.competency', t.competency); push('astro.style', t.style); push('astro.theme2026', h.year_2026?.theme);
  // v0.7 — 가설 수렴 조건용 리포트 칸(handoff 추가 요청 · 없으면 건너뜀)
  push('astro.q3_verdict', h.report?.q3_verdict);                 // 순풍/보통/역풍(A13)
  if (h.report?.weak_competencies?.length) push('astro.weak_competencies', h.report.weak_competencies);   // A17a
  push('astro.a12d_id', h.report?.a12d_id);                       // 실린 A12d 문장 id
  if (h.year_end?.cautions?.length) push('astro.cautions', h.year_end.cautions);                         // A10 문구
  return out;
}

/** 원본 데이터 주입(운영: DB 표 sw_ob_test_root_cues·sw_ob_test_bands·sw_ob_root_discriminators·sw_ob_astro_*·sw_ob_node_polarity에서 읽음) */
export function setData(d = {}) {
  if (d.testTable) TEST_TBLS = { ...TEST_TBLS, [DEFAULT_INSTRUMENT]: d.testTable };   // 디저트 테스트(호환)
  if (d.testTables) TEST_TBLS = { ...TEST_TBLS, ...d.testTables };                 // { instrument: 표 }
  if (d.discriminators) DISC = d.discriminators;
  if (d.astroCues) ASTRO_C = d.astroCues;
  if (d.astroStatements) ASTRO_S = d.astroStatements;
  if (d.nodePolarity) NODE_POLARITY = d.nodePolarity;
  return true;
}
export const TEST_CUES = (inst = DEFAULT_INSTRUMENT) => (TEST_TBLS[inst] || EMPTY_TBL).cues;
