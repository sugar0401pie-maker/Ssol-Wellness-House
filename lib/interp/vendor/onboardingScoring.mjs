// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v2.3/ssol_onboarding_scoring_v0.8.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 온보딩 → 해석 축 점수 · 최신 정보 우선 · 가설 노출 판단 · 가설 수렴 점수 (v0.6 · 2026-10-20 · ESM)
 * v0.6: 변화 조건(changed) · 심리테스트 슬롯을 검사별로(test.dessert.*) · 나이 칸(profileSignals) · 아스트로 Q2 같은 보기 두 답(버텨·고생 / 멈춤·그만하자)
 * v0.5: 데이터는 setData()로만(운영: DB sw_ob_option_axes·sw_ob_dessert_types·sw_ob_combos·sw_ob_hypotheses·sw_ob_option_groups·sw_ob_test_domains)
 *       가설 조건(수렴 신호) 기계 판정 · 온보딩 단서 = 문항 무게 × 순위 + 수렴 + 조합(뿌리당 최대 2.5) · 같은 보기 가설 순서 정하기
 * 순수 함수만 포함. DB 읽기/쓰기는 호출하는 쪽에서 처리.
 *
 * 원칙
 *  - 온보딩은 처음 한 번만 받는다 → 오래됐다고 버리거나 다시 묻지 않는다(기한 없음).
 *  - 같은 내용에 대해 정보가 여러 개면 "가장 최근 정보"가 이긴다
 *    (온보딩 답 < 그 뒤의 심리테스트 결과 < 그 뒤의 대화 답 — 시간 순서로 판단, 출처 순서가 아님).
 *  - 시각이 같으면 대화 > 심리테스트 > 온보딩.
 *  - 🔒 안전 신호는 최신 여부와 상관없이 기존 안전 라우터 규칙이 우선(여기서 다루지 않음).
 *
 * 축: NOV 새로움(+)/익숙함(-) · SOC 함께(+)/혼자(-) · MOV 움직임(+)/쉼(-) · GRO 해냄(+)/누림(-) · SHR 나누기(+)/나만(-)
 */
export const AXES = ['NOV', 'SOC', 'MOV', 'GRO', 'SHR'];
let OPTION_AXES = {};   // { question_id: { option_key: [NOV,SOC,MOV,GRO,SHR] } } — sw_ob_option_axes

export const CONFIG = {
  rankWeights: [3, 2, 1],              // 1·2·3순위
  maxRankWeight: 6,                    // 3+2+1 — 확신도 계산 기준
  inferredOtherFactor: 0.5,            // '기타' 문장을 보기로 추정했을 때 가중치 배수
  inferredOtherMinSim: 0.75,           // 추정 유사도 최소값
  exclusiveFlags: { weekends_ranked: { not_sure: 'weekend_unsure' }, hobbies_ranked: { no_hobby_yet: 'no_hobby_yet' } },
  behaviorQuestions: { hobbies_ranked: 0.8, weekends_ranked: 0.5 }, // 취미=좋아하거나 관심 있는 것(관심만 있는 경우 포함 → 0.8), 주말=상상한 이상적인 쉼(0.5)
  aspirationQuestions: { values_ranked: 1.0 },                       // 바라는 것
  levelCut: 1.0,                       // |축 점수| ≥ 1.0 이면 high/low
  gapCut: 1.5,                         // 가치-행동 차이 기준
  minWeight: 0.8,                      // 합친 가중치가 이보다 낮으면 level='unknown', 차이 플래그 안 만듦
  noAnswerRetryDays: 14,               // 확인 질문에 답 없이 넘어간 가설만 기간 뒤 다시 후보(정보가 아니므로)
  testLowScore: 2.5,                   // 심리테스트 하위요인 1~5점 평균이 이 값 이하면 low 플래그(임시값)
  sourceRankAtSameTime: { chat: 3, test: 2, onboarding: 1 },
  // ── 온보딩 → 뿌리 단서(v0.5 · 검수 OB-01~OB-08) ──
  cueQuestionBase: { values_ranked: 1.0, hobbies_ranked: 0.8, weekends_ranked: 0.5, focus_domains: 1.0 },   // OB-02 문항 무게(L1 가치 > L2 취미 > L3 주말)
  cueRankFactor: [1.0, 0.7, 0.5],      // OB-02 1·2·3순위(관심 영역은 순위 없음 → 1.0)
  convergencePerSignal: 0.5,           // OB-03 수렴 신호 하나당
  convergenceMax: 1.0,                 // OB-03 가설당 수렴 상한
  comboBonus: 0.5,                     // RR-09 조합(뿌리당 한 번)
  rootCap: 2.5,                        // OB-01 온보딩 출처 뿌리당 상한 — 다른 출처 0.5만 더해지면 유력(3점·2곳)
  strongCandidate: 2.0,                // OB-05 이 이상이면 "온보딩 강한 후보" → 확인 질문·카드 먼저
};

const zero = () => Object.fromEntries(AXES.map(a => [a, 0]));
const ts = t => new Date(t).getTime();

/* ───────────── 1. 온보딩 순위형 점수 ───────────── */
/**
 * answer = { value: ['opt1','opt2','opt3'], other_text?, other_inferred?: [{key, sim}], answered_at }
 * - 고르지 않은 보기: 0점이 아니라 '정보 없음' → 평균에 넣지 않음
 * - 배타 보기(잘 모르겠어요·아직 취미 없음): 축 점수 없음, 플래그만
 * - 기타: 추정 매핑 유사도 ≥ 0.75면 그 보기로 보되 가중치 ×0.5, 아니면 플래그만(other_pending)
 * - 결과: 가중 평균(−2~+2) + 확신도(0~1)
 */
export function scoreRanked(qid, answer) {
  const out = { axes: zero(), confidence: 0, flags: [], used: [] };
  if (!answer || !Array.isArray(answer.value) || answer.value.length === 0) { out.flags.push(`${qid}:skipped`); return out; }
  const table = OPTION_AXES[qid] || {};
  let wsum = 0; const acc = zero();
  answer.value.slice(0, 3).forEach((key, i) => {
    let w = CONFIG.rankWeights[i];
    const ex = (CONFIG.exclusiveFlags[qid] || {})[key];
    if (ex) { out.flags.push(ex); return; }
    let vec = table[key];
    if (key === 'other') {
      const best = (answer.other_inferred || []).filter(x => x.sim >= CONFIG.inferredOtherMinSim).sort((a, b) => b.sim - a.sim)[0];
      if (!best || !table[best.key]) { out.flags.push(`${qid}:other_pending`); return; }
      vec = table[best.key]; w *= CONFIG.inferredOtherFactor; out.flags.push(`${qid}:other_inferred:${best.key}`);
    }
    if (!vec) { out.flags.push(`${qid}:unknown_option:${key}`); return; }
    AXES.forEach((a, j) => { acc[a] += w * vec[j]; });
    wsum += w; out.used.push({ key, rank: i + 1, weight: w });
  });
  if (wsum > 0) AXES.forEach(a => { out.axes[a] = +(acc[a] / wsum).toFixed(2); });
  out.confidence = +Math.min(1, wsum / CONFIG.maxRankWeight).toFixed(2);
  return out;
}

function combine(perQ, weights) {
  const acc = zero(); let wsum = 0;
  for (const [qid, qw] of Object.entries(weights)) {
    const r = perQ[qid]; if (!r) continue;
    const w = qw * r.confidence; if (w <= 0) continue;
    AXES.forEach(a => { acc[a] += w * r.axes[a]; }); wsum += w;
  }
  const axes = zero();
  if (wsum > 0) AXES.forEach(a => { axes[a] = +(acc[a] / wsum).toFixed(2); });
  return { axes, weight: +wsum.toFixed(2) };
}
const level = (v, w) => (w < CONFIG.minWeight ? 'unknown' : v >= CONFIG.levelCut ? 'high' : v <= -CONFIG.levelCut ? 'low' : 'mid');

/** 온보딩 답 → 프로필(기한 없음). 온보딩 답 자체가 수정되면 다시 호출. */
export function computeOnboardingProfile(answers) {
  const perQ = {}; const flags = [];
  for (const qid of ['weekends_ranked', 'hobbies_ranked', 'values_ranked']) {
    perQ[qid] = scoreRanked(qid, answers[qid]); flags.push(...perQ[qid].flags);
  }
  const behavior = combine(perQ, CONFIG.behaviorQuestions);
  const aspiration = combine(perQ, CONFIG.aspirationQuestions);
  const gap = Object.fromEntries(AXES.map(a => [a, +(aspiration.axes[a] - behavior.axes[a]).toFixed(2)]));
  const focusVals = answers.focus_domains?.value || [];
  const domainPrior = Object.fromEntries(focusVals.filter(k => !['none', 'other'].includes(k)).map(k => [k, 1]));
  if (focusVals.includes('none')) flags.push('focus_none');
  const context = {};
  for (const qid of ['relationship_status', 'dating_interest', 'relationship_stage', 'childcare_status', 'child_age_groups', 'primary_activity', 'daily_time', 'excluded_activities']) {
    if (answers[qid]) context[qid] = answers[qid].value;
  }
  const ranks = {};
  for (const qid of ['weekends_ranked', 'hobbies_ranked', 'values_ranked']) {
    ranks[qid] = Object.fromEntries((answers[qid]?.value || []).slice(0, 3).map((k, i) => [k, i + 1]));
  }
  const answeredAt = Object.values(answers).map(a => a?.answered_at).filter(Boolean).sort().pop() || null;
  return {
    answered_at: answeredAt, per_question: perQ,
    behavior: { ...behavior, levels: Object.fromEntries(AXES.map(a => [a, level(behavior.axes[a], behavior.weight)])) },
    aspiration: { ...aspiration, levels: Object.fromEntries(AXES.map(a => [a, level(aspiration.axes[a], aspiration.weight)])) },
    gap, gap_flags: AXES.filter(a => Math.abs(gap[a]) >= CONFIG.gapCut && aspiration.weight >= CONFIG.minWeight && behavior.weight >= CONFIG.minWeight).map(a => `gap_${a}`),
    ranks, domain_prior: domainPrior, context, flags,
    answered: Object.fromEntries(Object.keys(answers).map(q => [q, Array.isArray(answers[q]?.value) ? answers[q].value.length > 0 : answers[q]?.value != null])),
  };
}

/* ───────────── 2. 최신 정보 우선(신호 저장소) ───────────── */
/**
 * 모든 정보는 "신호" 한 줄로 쌓는다: { slot, value, source: 'onboarding'|'test'|'chat', observed_at, ref? }
 *  - onboarding: 온보딩 답·그 답에서 나온 축/플래그 (예: slot 'axis.behavior.NOV', 'context.primary_activity')
 *  - test: 심리테스트 결과 (예: 'test.approval_cw_pct', 'test.type') — 재검사하면 새 줄 추가
 *  - chat: 대화에서 확인된 것 (예: 확인 질문 답 'hyp.WK-FAV-3', 에너지 'state.energy', 바뀐 상황 'context.primary_activity')
 * 같은 slot에서는 observed_at이 가장 늦은 값이 현재 값. 시각이 같으면 chat > test > onboarding.
 */
export function latestBySlot(signals) {
  const best = {};
  for (const s of signals) {
    const cur = best[s.slot];
    if (!cur) { best[s.slot] = s; continue; }
    const d = ts(s.observed_at) - ts(cur.observed_at);
    if (d > 0 || (d === 0 && (CONFIG.sourceRankAtSameTime[s.source] || 0) > (CONFIG.sourceRankAtSameTime[cur.source] || 0))) best[s.slot] = s;
  }
  return best;
}

/** 온보딩 프로필을 신호 줄로 변환(저장용) */
export function onboardingToSignals(profile) {
  const t = profile.answered_at; const out = [];
  AXES.forEach(a => {
    out.push({ slot: `axis.behavior.${a}`, value: profile.behavior.axes[a], source: 'onboarding', observed_at: t });
    out.push({ slot: `axis.aspiration.${a}`, value: profile.aspiration.axes[a], source: 'onboarding', observed_at: t });
  });
  for (const [k, v] of Object.entries(profile.context)) out.push({ slot: `context.${k}`, value: v, source: 'onboarding', observed_at: t });
  for (const [k, v] of Object.entries(profile.domain_prior)) out.push({ slot: `focus.${k}`, value: v, source: 'onboarding', observed_at: t });
  return out;
}

/**
 * 심리테스트(디저트 웰니스 유형 v2) 결과 → 신호 줄. 재검사 시 새 결과로 다시 호출하면 최신이 이김
 * test = { dessert: 'brownie', factorScores: { competence_cw: 2.5, approval_cw: 3.0, ... }, modeScores?: {...} }
 *  - 유형은 DB에 디저트 코드로 저장 → 영역(CAR/LOV/REL/SLF/DIR) × 주 대처방식(primary/secondary/disengage)으로 풀어 씀
 *  - 하위요인 점수는 1~5 평균(역채점 후, 높을수록 건강) → testLowScore 이하이면 '낮음' 플래그(임시값 — 전문위원 확정)
 *  - 주 대처방식이 이탈(disengage)이면 회피 관련 공통 뿌리(ROOT-01·09)의 근거(D등급)로 쓸 수 있음
 */
let DESSERT_TYPES = {}; // { brownie: 'CAR-primary', ... } — sw_ob_dessert_types
let TEST_DOMAINS = {}; // { CAR: [요인...] } — sw_ob_test_domains(디저트)
export const INSTRUMENT_PREFIX = { dessert_v2: 'dessert' };   // 검사 → 신호 칸 이름
export function testToSignals(test, observedAt) {
  const out = [];
  const P = `test.${INSTRUMENT_PREFIX[test.instrument || 'dessert_v2'] || test.instrument}`;   // 검사별 칸(디저트 = test.dessert.*) — 다른 검사 조건과 섞이지 않게
  const typeCode = test.dessert ? DESSERT_TYPES[test.dessert] : test.typeCode;
  if (typeCode) {
    const [axis, mode] = typeCode.split('-');
    out.push({ slot: `${P}.type`, value: typeCode, source: 'test', observed_at: observedAt, ref: test.dessert || null });
    out.push({ slot: `${P}.axis`, value: axis, source: 'test', observed_at: observedAt });
    out.push({ slot: `${P}.main_domain`, value: axis, source: 'test', observed_at: observedAt });   // 조합 CB-22~32
    out.push({ slot: `${P}.coping`, value: mode, source: 'test', observed_at: observedAt });
    out.push({ slot: `flag.${P}.disengage`, value: mode === 'disengage', source: 'test', observed_at: observedAt });
  }
  if (test.copingSub) for (const [k, v] of Object.entries(test.copingSub)) out.push({ slot: `${P}.coping_sub.${k}`, value: v, source: 'test', observed_at: observedAt });
  for (const [k, v] of Object.entries(test.factorScores || {})) {
    out.push({ slot: `${P}.factor.${k}`, value: v, source: 'test', observed_at: observedAt });
    out.push({ slot: `flag.${P}.low_${k}`, value: v <= CONFIG.testLowScore, source: 'test', observed_at: observedAt });
  }
  for (const [d, fs] of Object.entries(TEST_DOMAINS)) {                       // v0.5 영역 점수(요인 평균) — 가설 조건 test.domain.<D>
    const vs = fs.map(f => test.factorScores?.[f]).filter(v => v != null);
    if (vs.length) out.push({ slot: `${P}.domain.${d}`, value: +(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2), source: 'test', observed_at: observedAt });
  }
  return out;
}

/** 현재 사용자 상태(가장 최신 값만) */
export function currentState(signals, now = new Date().toISOString()) {
  const latest = latestBySlot(signals);
  const hist = {};
  for (const x of signals || []) if (!x.retracted_at && !x.hidden_at) (hist[x.slot] = hist[x.slot] || []).push(x);
  for (const k of Object.keys(hist)) hist[k].sort((a, b) => ts(a.observed_at) - ts(b.observed_at));
  return { latest, now, get: slot => latest[slot]?.value, sourceOf: slot => latest[slot]?.source, at: slot => latest[slot]?.observed_at, history: slot => hist[slot] || [] };
}

/* ───────────── 3. 가설 노출 판단 ───────────── */
/**
 * hyp = { id, required_questions:[...], depends_on:[slot...], concepts:[concept_id...], test_flags:[...] }
 * hypState = user_hypothesis_state 한 행(없으면 null) — { status, answered_at }
 * newerEvidence = 거절 뒤에 들어온 근거 신호 목록 — 대화에서 매칭된 개념 { type:'concept', id, observed_at } 또는 심리테스트 { type:'test_flag', id, observed_at }
 *
 * 규칙
 *  - 한 대화에 1개(R-05)
 *  - 필요한 온보딩 문항을 건너뛰었으면 사용 안 함(기한은 없음)
 *  - accepted(맞다고 함): 다시 묻지 않음 — 확인된 사실로 사용
 *  - rejected/partial: 기간이 아니라 "거절 이후 더 최신 근거"가 생겼을 때만 다시 후보(확인형으로)
 *  - shown_no_answer: 정보가 아니므로 14일 뒤 다시 후보
 */
export function canShowHypothesis(hyp, onboarding, hypState, newerEvidence = [], now = new Date().toISOString(), alreadyShownThisChat = false) {
  if (alreadyShownThisChat) return { ok: false, reason: 'one_per_chat' };
  for (const q of hyp.required_questions || []) if (!onboarding.answered[q]) return { ok: false, reason: `skipped:${q}` };
  if (!hypState) return { ok: true, mode: 'normal' };
  if (hypState.status === 'accepted') return { ok: false, reason: 'already_confirmed_use_as_fact' };
  if (hypState.status === 'shown_no_answer') {
    const ok = ts(now) - ts(hypState.answered_at) >= CONFIG.noAnswerRetryDays * 86400000;
    return ok ? { ok: true, mode: 'normal' } : { ok: false, reason: 'no_answer_wait' };
  }
  // rejected · partial — test_flag 근거는 그 플래그의 '최신 값'이 true일 때만 넘겨야 함(재검사로 풀렸으면 근거 아님)
  const support = newerEvidence.filter(e => ts(e.observed_at) > ts(hypState.answered_at) &&
    ((e.type === 'concept' && (hyp.concepts || []).includes(e.id)) || (e.type === 'test_flag' && (hyp.test_flags || []).includes(e.id))));
  if (support.length === 0) return { ok: false, reason: `${hypState.status}_no_newer_evidence` };
  return { ok: true, mode: 'confirm_only', because: support.map(e => `${e.type}:${e.id}`) };
}

/**
 * 가설 조건이 기대는 온보딩 칸(hyp.depends_on: slot 목록) 중 하나라도
 * 온보딩보다 최신인 대화·심리테스트 값으로 바뀌었으면 그 가설은 지금 근거가 없음 → 꺼내지 않음.
 * 가설 조건 자체도 profile이 아니라 currentState(최신 값) 기준으로 다시 평가한다.
 */
export function overriddenByNewer(hyp, state) {
  const hit = (hyp.depends_on || []).filter(slot => state.sourceOf(slot) && state.sourceOf(slot) !== 'onboarding');
  return hit.length ? { ok: false, reason: 'onboarding_overridden_by_newer', slots: hit.map(x => `${x}=${JSON.stringify(state.get(x))}(${state.sourceOf(x)})`) } : null;
}

/** 확인 질문 답 → 가설 상태 + 최신 신호 1줄(대화 출처) */
export function recordHypothesisResponse(hypId, answerType, now = new Date().toISOString(), answerText = '', chatId = null) {
  return {
    state: { hyp_id: hypId, status: answerType, answer_text: answerText, answered_at: now, chat_id: chatId },
    signal: { slot: `hyp.${hypId}`, value: answerType, source: 'chat', observed_at: now, ref: chatId },
  };
}


/* ───────────── 4. 조합 규칙(문항을 넘나드는 해석) v2 ───────────── */
/**
 * combos_v0.3.json(조합 21개) 평가 — 온보딩 답 + 프로필(축·차이) + 최신 상태(대화·심리테스트)
 * 반환: [{ id, roots, primaryRoot, bonus:0.5, entry(시작할 멤버 가설), theory, mod, sensitive, boosted }]
 * 규칙: RR-09 주 후보 뿌리에 +0.5 한 번(여러 조합이 같은 뿌리에 걸려도 최대 +0.5), 온보딩은 여전히 출처 1곳
 */
let COMBO_DATA = { combos: [], optOfPrefix: {} };   // sw_ob_combos(+ 가설 접두 → 보기)
function chosen(answers, q) { const v = answers[q]?.value; return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function condOk(c, answers, profile, state) {
  if (c.all) return c.all.every(x => condOk(x, answers, profile, state));
  if (c.anyOf) return c.anyOf.some(x => condOk(x, answers, profile, state));
  if (c.q) {
    const vals = chosen(answers, c.q);
    return vals.some((k, i) => c.any.includes(k) && (!c.maxRank || i < c.maxRank));
  }
  if (c.axis) {
    const [kind, ax] = c.axis.split('.'); const p = profile[kind];
    if (!p || p.weight < (c.minW || 0)) return false;
    return c.le != null ? p.axes[ax] <= c.le : p.axes[ax] >= c.ge;
  }
  if (c.qaxis) {
    const r = profile.per_question[c.qaxis[0]]; if (!r || r.confidence === 0) return false;
    const v = r.axes[c.qaxis[1]]; return c.le != null ? v <= c.le : v >= c.ge;
  }
  if (c.gap) {
    if (profile.aspiration.weight < CONFIG.minWeight || profile.behavior.weight < CONFIG.minWeight) return false;
    return profile.gap[c.gap] >= c.ge;
  }
  if (c.state) {                                                     // 최신 신호: eq 또는 숫자 구간(le/ge) — 심리테스트 요인 구간 조합(CB-53~)
    if (!state) return false; const v = state.get(c.state);
    if (c.eq !== undefined) return v === c.eq;
    return typeof v === 'number' && (c.le == null || v <= c.le) && (c.ge == null || v >= c.ge);
  }
  return false;
}
export function evaluateCombos(answers, profile, state = null) {
  const out = []; const bonused = new Set();
  const hit = COMBO_DATA.combos.filter(cb => condOk(cb.cond, answers, profile, state)), hitIds = new Set(hit.map(cb => cb.id));
  for (const cb of hit) {
    if (cb.merge_into && hitIds.has(cb.merge_into)) {                 // RR-18 같은 확인 질문 조합 → 앞 조합으로 묶고 질문 한 번(가산 없음)
      out.push({ id: cb.id, name: cb.name, roots: cb.roots, primaryRoot: cb.roots[0] || null, bonus: 0, entry: null, theory: cb.theory, mod: null, sensitive: cb.sensitive, mergedInto: cb.merge_into, boosted: false });
      continue;
    }
    const entry = cb.entry.find(h => {
      const o = COMBO_DATA.optOfPrefix[h.split('-').slice(0, 2).join('-')];
      return o && chosen(answers, o[0]).includes(o[1]);
    }) || cb.entry[0] || null;
    const primaryRoot = cb.roots[0] || null;
    const bonus = primaryRoot && !bonused.has(primaryRoot) ? 0.5 : 0;
    if (bonus) bonused.add(primaryRoot);
    out.push({ id: cb.id, name: cb.name, roots: cb.roots, primaryRoot, bonus, entry, theory: cb.theory, mod: cb.mod, sensitive: cb.sensitive,
      boosted: cb.boost ? condOk(cb.boost, answers, profile, state) : false });
  }
  return out;
}


/* ───────────── 5. 가설 수렴 신호 · 온보딩 단서 (v0.5) ─────────────
 * 가설마다 cond_json.signals = [항목…] (sw_ob_hypotheses.cond_json). 항목 하나가 맞으면 +0.5, 가설당 최대 +1.0.
 * 항목: {q, any|group, maxRank?} · {q, none|noneGroup} · {self:'rank', maxRank} · {state, eq|in|le|ge} · {axis, le|ge} · {anyOf:[…]}
 * 대화·장면 조각(cond_chat_cues): v0.7부터 sw_ob_hyp_chat_links로 연결 — 대화에서 그 조각이 확인되면(같음 연결만) 수렴 신호 하나로 셈(OB-16).
 *   ctx.chat = { claims:Set(claim_id), scenes:Set(scene_id), topics:Set(주제), changed:Set(정보 칸) } — 없으면 예전과 같음.
 * 판정 불가 조각(cond_unknown)은 온보딩 점수에 쓰지 않음.
 */
let CHAT_LINKS = {};  // hyp_id → [{cue, link_type, target, match}] — sw_ob_hyp_chat_links (match '같음'만 점수에 씀)
/** 대화 조각 연결 하나가 지금 대화 사실로 맞는지 */
export function chatLinkMet(l, chat) {
  if (!chat || l.match !== '같음') return false;
  if (l.link_type === 'claim') return chat.claims?.has(l.target) || false;
  if (l.link_type === 'scene') return chat.scenes?.has(l.target) || false;
  if (l.link_type === 'topic') return chat.topics?.has(l.target) || false;
  if (l.link_type === 'state') return chat.changed?.has(l.target) || false;
  return false;
}
/** 가설의 대화 조각 중 맞은 조각 목록(같은 조각에 대상이 여럿이면 하나만 맞아도 그 조각은 맞음) */
export function chatCuesMet(hypId, chat) {
  const by = {}; for (const l of CHAT_LINKS[hypId] || []) if (l.match === '같음') (by[l.cue] = by[l.cue] || []).push(l);
  return Object.entries(by).filter(([, ls]) => ls.some(l => chatLinkMet(l, chat))).map(([cue]) => cue);
}
let HYPS = [];        // [{hyp_id, question_id, option_key, answers(아스트로 한국어 답 목록), root_id, nature, cue_weight, ord, signals}]
let GROUPS = {};      // { group_id: { question_id, keys:[…] } } — sw_ob_option_groups
let NODE_POL = {};    // 노드 → absent/desired (자원 뿌리의 부족·바람 → 점수 대신 목표)
let PENDING = new Set(); // 앱 반영 전 보기 'question_id:option_key' (sw_ob_options.status='추가 요청')
const ONB_QUESTIONS = ['values_ranked', 'hobbies_ranked', 'weekends_ranked', 'focus_domains'];
function _keysOf(x) { return x.group ? (GROUPS[x.group]?.keys || []) : x.noneGroup ? (GROUPS[x.noneGroup]?.keys || []) : (x.any || x.none || []); }
/** 수렴 신호 항목 하나 판정. ctx = { answers, profile, state, self:{q, key, rank} } — 모르는 값은 false(맞다고 보지 않음) */
export function evalSignal(x, ctx) {
  if (x.anyOf) return x.anyOf.some(y => evalSignal(y, ctx));
  if (x.self === 'rank') return ctx.self?.rank != null && ctx.self.rank <= (x.maxRank || 3);
  if (x.q) {
    const vals = chosen(ctx.answers, x.q); const keys = _keysOf(x);
    if (x.none || x.noneGroup) {                                                                     // 답했는데 그 보기를 안 고름
      if (keys.some(k => PENDING.has(`${x.q}:${k}`))) return false;                                  // 앱에 아직 없는 보기는 "안 고름"으로 보지 않음(누구나 맞게 됨 · OB-11)
      return vals.length > 0 && !vals.some(k => keys.includes(k));
    }
    return vals.some((k, i) => keys.includes(k) && (!x.maxRank || i < x.maxRank));
  }
  if (x.state) {
    const v = ctx.state?.get(x.state); if (v == null) return false;
    const arr = Array.isArray(v) ? v : [v];
    if (x.eq !== undefined) return arr.includes(x.eq);
    if (x.in) return arr.some(a => x.in.includes(a));
    return typeof v === 'number' && (x.le == null || v <= x.le) && (x.ge == null || v >= x.ge);
  }
  if (x.changed) {                                                                              // 변화: 최근 withinDays 안에 값이 바뀜(이전 값이 있어야)
    const h = ctx.state?.history ? ctx.state.history(x.changed) : []; if (h.length < 2) return false;
    const last = h[h.length - 1], key = v => JSON.stringify(Array.isArray(v) ? [...v].sort() : v);
    if (!h.slice(0, -1).some(p => key(p.value) !== key(last.value))) return false;
    const now = ts(ctx.state.now || new Date().toISOString());
    if (now - ts(last.observed_at) > (x.withinDays || 180) * 86400000) return false;
    if (x.to) { const arr = Array.isArray(last.value) ? last.value : [last.value]; return arr.some(a => x.to.includes(a)); }
    return true;
  }
  if (x.axis) {
    const [kind, ax] = x.axis.split('.'); const p = ctx.profile?.[kind];
    if (!p || p.weight < CONFIG.minWeight) return false;
    const v = p.axes[ax]; return (x.le == null || v <= x.le) && (x.ge == null || v >= x.ge);
  }
  return false;
}
/**
 * 고른 보기마다 그 보기의 가설을 점수·순서대로(OB-02~04)
 * 점수 = (수렴 신호가 하나 이상 맞을 때만) 가설 기본 단서 × 순위 계수 + 수렴(맞은 항목 × 0.5, 최대 1.0)
 * 순서 = 점수 → 맞은 수렴 신호 수 → 맞은 비율 → 가설 번호(작성 순서)
 * 아스트로 문항 가설(AQ*)은 점수를 아스트로 근거(D)로 따로 받으므로 여기서는 순서만 정함(points 0)
 */
export function rankOnboardingHypotheses(answers, profile, state = null, chat = null) {
  const out = [];
  for (const h of HYPS) {
    const isAstro = h.question_id.startsWith('astro_');
    let rank = null;
    if (isAstro) { const v = state?.get(`astro.${h.question_id.slice(6)}`); if (v == null || !(h.answers || []).includes(v)) continue; rank = 1; }   // 같은 보기에 답이 둘인 경우(버텨·고생)
    else { const vals = chosen(answers, h.question_id); const i = vals.indexOf(h.option_key); if (i < 0) continue; rank = h.question_id === 'focus_domains' ? 1 : i + 1; }
    const ctx = { answers, profile, state, self: { q: h.question_id, key: h.option_key, rank } };
    const chatMet = chatCuesMet(h.hyp_id, chat);                                                  // v0.7 OB-16 대화 조각
    const nChatCues = new Set((CHAT_LINKS[h.hyp_id] || []).filter(l => l.match === '같음').map(l => l.cue)).size;
    const met = [...(h.signals || []).filter(x => evalSignal(x, ctx)), ...chatMet];
    const conv = Math.min(CONFIG.convergenceMax, met.length * CONFIG.convergencePerSignal);
    const base = isAstro ? 0 : (h.cue_weight ?? CONFIG.cueQuestionBase[h.question_id] ?? 1.0) * (h.question_id === 'focus_domains' ? 1 : CONFIG.cueRankFactor[rank - 1]);   // 가설 기본 단서(sw_ob_hypotheses.cue_weight) × 순위
    out.push({ hyp_id: h.hyp_id, question_id: h.question_id, option_key: h.option_key, rank, root_id: h.root_id, nature: h.nature,
      base: +base.toFixed(2), convergence: isAstro ? 0 : conv, points: (isAstro || !met.length) ? 0 : +(base + conv).toFixed(2), met: met.length, of: (h.signals || []).length + nChatCues, chat_met: chatMet, ord: h.ord,   // OB-03 수렴 없는 가설은 순서 후보로만(경쟁 해석 10개에 모두 점수를 주지 않음)
      polarity: NODE_POL[h.hyp_id] || null, astro: isAstro });
  }
  const byOpt = {};
  for (const r of out) (byOpt[`${r.question_id}:${r.option_key}`] = byOpt[`${r.question_id}:${r.option_key}`] || []).push(r);
  const ratio = r => (r.of ? r.met / r.of : 0);
  const order = (a, b) => (b.points - a.points) || (b.met - a.met) || (ratio(b) - ratio(a)) || (a.ord - b.ord);   // OB-04
  for (const k of Object.keys(byOpt)) byOpt[k].sort(order).forEach((r, i) => { r.order_in_option = i + 1; });
  return { all: [...out].sort(order), byOption: byOpt };
}
/**
 * 뿌리별 온보딩 단서(OB-01·RR-02·RR-09): 같은 뿌리는 가장 큰 가설 점수 하나 + 조합 +0.5(한 번) · 최대 2.5
 * 자원 뿌리의 부족·바람 노드(NODE_POL)는 점수 대신 목표(goal)
 * 반환 [{ root, points, hyp, convergence, combo, strong, goal? }]
 */
export function onboardingRootCues(answers, profile, state = null, chat = null) {
  const { all } = rankOnboardingHypotheses(answers, profile, state, chat);   // v0.7 chat = 대화 조각 사실(OB-16)
  const best = {}, goals = [];
  for (const r of all) {
    if (r.astro || !r.root_id || r.points <= 0) continue;
    if (r.polarity === 'absent' || r.polarity === 'desired') { goals.push({ root: r.root_id, hyp: r.hyp_id, goal: r.polarity, points: r.points }); continue; }
    if (!best[r.root_id] || r.points > best[r.root_id].points) best[r.root_id] = { root: r.root_id, points: r.points, hyp: r.hyp_id, convergence: r.convergence };
  }
  const combos = evaluateCombos(answers, profile, state);
  for (const c of combos) if (c.bonus && c.primaryRoot) {
    const b = best[c.primaryRoot] || (best[c.primaryRoot] = { root: c.primaryRoot, points: 0, hyp: c.entry, convergence: 0 });
    if (!b.combo) { b.combo = c.id; b.points += CONFIG.comboBonus; }
  }
  const out = Object.values(best).map(b => ({ ...b, points: +Math.min(CONFIG.rootCap, b.points).toFixed(2) }));
  for (const b of out) b.strong = b.points >= CONFIG.strongCandidate;
  return [...out.sort((a, b) => b.points - a.points), ...goals];
}
/** DB 표 행 → 데이터 */
export function setData(d = {}) {
  if (d.optionAxes) OPTION_AXES = d.optionAxes;
  if (d.dessertTypes) DESSERT_TYPES = d.dessertTypes;
  if (d.testDomains) TEST_DOMAINS = d.testDomains;
  if (d.combos) COMBO_DATA = d.combos;
  if (d.hypotheses) HYPS = d.hypotheses;
  if (d.groups) GROUPS = d.groups;
  if (d.nodePolarity) NODE_POL = d.nodePolarity;
  if (d.pendingOptions) PENDING = new Set(d.pendingOptions);
  if (d.chatLinks) { CHAT_LINKS = {}; for (const l of d.chatLinks) (CHAT_LINKS[l.hyp_id] = CHAT_LINKS[l.hyp_id] || []).push(l); }
  return true;
}

/** 나이 칸(가설 조건 profile.age · profile.decade_turn) — 출생 연도는 아스트로 handoff(user.birth_year) 또는 프로필에서 */
export function profileSignals({ birthYear, birthDate, now = new Date().toISOString(), source = 'onboarding' } = {}) {
  const n = new Date(now); let age = null;
  if (birthDate) { const b = new Date(birthDate); age = n.getFullYear() - b.getFullYear() - ((n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) ? 1 : 0); }
  else if (birthYear) age = n.getFullYear() - Number(birthYear) - 1;                  // 연도만 알면 보수적으로(생일 전)
  if (age == null || Number.isNaN(age)) return [];
  return [{ slot: 'profile.age', value: age, source, observed_at: now }, { slot: 'profile.decade_turn', value: [9, 0].includes(age % 10), source, observed_at: now }];
}
