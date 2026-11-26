// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.39/ssol_case_v0.19.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 사례개념화(쏠 사례개념화 프레임워크 v0.3 · CSO 11-04) — v0.3(11-05 시뮬 5차 고침: 과제 0개·1개 · 영역 안 맞는 과제 · 반대 단계 과제 · 예측 질문 응답)
 *  - 고민 하나 = 장면 하나(concern_id = scene_key). 이론 하나로 네 층을 채움(CASE-01·02)
 *  - 단계: 알아차림(관찰 과제) · 받아들임(수용 과제) · 바꿔 감(통합 과제)(CASE-04·05)
 *  - 대처 방식(회피·과잉보상·굴복)에 따라 바꿔 감 과제의 방향을 고름(CASE-06) · 가짜 진전 의심(CASE-08)
 *  - 결핍 — 조건이 차면 휴먼 세션 안내(CASE-03) · 과제 기록(CASE-10 · RC-21) · 결핍 추측만 한다는 원칙은 없앰(CSO 11-23)
 * 판단만 돌려주고 안전 판단은 하지 않음(lib/safety). 데이터: setCaseData(caseDataFromDb(tables)) 또는 시험용 data/case_v0.30.json
 */
let CASE = { scene_lens: [], root_layers: {}, option_tags: {}, practice_tags: {}, stage_signals: [], career_theory: {}, domain_theory: {}, root_theory: {}, root_practices: {}, practice_area: {}, redirect_lines: [] };
const LENS = () => Object.fromEntries((CASE.scene_lens || []).map(x => [x.scene_key, x]));
export const CASE_CFG = { humanOnly: false, redirectTypes: [],   /* CSO 11-18: 예측·상대 마음·결정 질문 모두 답함 — 고정 문장으로 돌리지 않음. 다시 켜려면 ['prediction','other_mind','decision'] */ enabled: false, stageMin: 2, maxTasks: 2, altMargin: 1.0, theoryBonus: 0.3, theoryAltBonus: 0.15, formatGap: 0.5, copingObserve: true, prefTheory: 0.5, ladderSlot: true, copingAllStages: true, copingTheory: 3, theorySlot: true, sceneTheory: true, sceneScore: 0.3, theoryBoth: true };
/** v0.18(11-23 · CSO 두 번째 · DB v5.31 · 규칙 WT-08): 갈래에서 실제로 해 볼 행동 — taskCandidates 결과의 branch.actions(아는 갈래에 first_actions가 있을 때 · 과제와 함께 먼저 권함)
 *  v0.17(11-23 · CSO: 엔진이 갈래를 보고 과제를 고름 — DB v5.30 sw_ob_sub_branches · sw_ob_sub_branch_roots · 규칙 WT-06):
 *    branchPlan(intentId, branchId, ruledOut) · taskCandidates가 세부 고민(opts.intentId)이 있으면 항상 갈래를 봄(opts.branchId = 글에서 정한 갈래 · 없으면 기본 갈래 1~3위를 가설로) → 결과에 branch
 *  v0.15(11-16): 지나가는 일로 본 길의 가벼운 과제(opts.route === 'light' — 힘 1 · 5분 이하를 먼저)
 *  v0.14(11-15): 자유 대화 길 — taskCandidates opts.roots(장부 상위 뿌리)로 뿌리 실천을 후보에 · 과제 결과로 본 이론(theoryAvoid) · 고민 상태에 ruled_out(겨루는 가설에서 아니라고 한 뿌리)
 *  v0.13(11-15): 대처 방식 자리가 없는 길은 남은 한 자리도 고민 이론으로(theoryBoth)
 *  v0.12(11-15): 장면의 고민 이론 실천(sceneTheory) — 장면(cs.concern_id)에 이어진 실천 가운데 지금 고민 이론의 것을 후보에 더함(sw_ob_scene_practices · 끝 뿌리에 그 이론의 실천이 없을 때 이론 한 자리가 씀)
 *  v0.11(11-15): 이론 한 자리(theorySlot) — 후보에 고민 이론의 실천이 있으면 둘 중 하나는 그 이론 · 보조지만 잘 맞는 이론(strong)도 주 이론처럼 셈
 *  v0.10(11-14): 받아들임·바꿔 감 단계에도 대처 방식 한 자리(copingAllStages)
 *  v0.9(11-10): 온보딩 맥락의 이론 규칙(lensFor ctx · applyCardPath person) — 빼는 이론 · 권하는 이론 · 이어 가기 한 자리(ladderSlot)
 *  v0.8(11-10): 알아차림 단계 = 뿌리 관찰 1 + 대처 방식 관찰 1(대처 방식을 알 때 · CASE.coping_fit) · 대처 방향이 다른 관찰·수용 실천은 뺌
 *  v0.7(11-10): 사람 점수(opts.personal) · 부 고민(secondaryId) · 쌓인 뿌리 상태로 이론 고르기(lensFor rootStates)
 *  v0.6(11-10): 실천 ↔ 이론(sw_ob_practice_theory) — 고민 상태의 이론(cs.theory)과 맞는 실천을 앞으로 · 그 이론과 충돌하는 실천은 뺌 */
function theoryAdj(cs, pid) {
  const t = CASE.practice_theory?.[pid]; if (!t || !cs.theory) return 0;
  if (t.conflict?.includes(cs.theory)) return null;
  if (t.main === cs.theory || t.strong?.includes(cs.theory)) return CASE_CFG.theoryBonus;
  if (t.also?.includes(cs.theory)) return CASE_CFG.theoryAltBonus;
  return 0;
}
export function practiceTheory(pid) { return CASE.practice_theory?.[pid] || null; }
export function setCaseData(d) { CASE = { ...CASE, ...d }; return CASE; }
export const STAGES = ['알아차림', '받아들임', '바꿔 감'];
export const STAGE_TASK = { '알아차림': '관찰', '받아들임': '수용', '바꿔 감': '통합' };
const PATTERN_LAYERS = ['행동', '사고·감정', '규칙·전략'];

export function newConcernState(userId, sceneKey) {
  const l = LENS()[sceneKey] || {};
  return { user_id: userId, concern_id: sceneKey, domain5: l.domain5 || null, theory: l.default_theory || null, career_type: l.career_type || null,
    stage: '알아차림', coping: null, layers_filled: [], stage_signals: {}, fake_progress: [], pattern_seen: false, resigned: false };
}

/**
 * CASE-02: 고민 하나 = 이론 하나. ① 진로는 고른 보기의 진로 갈래(가장 깊은 보기 우선)가 기본 이론을 정함
 * ② 끝 뿌리가 있으면 장면의 함께 쓸 이론(alt_theories) 중 그 뿌리와 더 잘 맞는 이론이 있을 때(뿌리-이론 점수가 기본보다 altMargin 이상 높을 때) 그 이론을 씀 — 이론 풀 20개를 고루 씀
 */
export function lensFor(sceneKey, pathOptionIds = [], endRoots = [], rootStates = null, ctx = null) {
  const l = LENS()[sceneKey] || {};
  let ct = l.career_type || null;
  for (const id of pathOptionIds) { const t = CASE.option_tags[id]; if (t?.career_type && t.career_type !== '해당 없음') ct = t.career_type; }
  let theory = l.domain5 === '진로' && ct ? (CASE.career_theory[ct] || l.default_theory) : l.default_theory;
  let alts = [].concat(l.alt_theories || []).flatMap(x => String(x).split(',')).filter(Boolean);
  let why = 'scene_default';
  // v0.9(11-10): 온보딩 맥락의 이론 규칙(ssol_personal.personFromOnboarding) — 빼는 이론은 후보에서 빼고, 권하는 이론은 +prefBonus
  const EX = new Set(ctx?.theoryExclude || []), PREF = new Set(ctx?.theoryPrefer || []), AVOID = new Set(ctx?.theoryAvoid || []);   // v0.14: 과제 결과로 본 이론(통한 이론 +prefTheory · 두 번 그대로였던 이론 −prefTheory)
  alts = alts.filter(t => !EX.has(t));
  // v0.7(11-10): 여러 대화에 쌓인 뿌리 상태도 봄 — 확인 ×1 · 가능 ×0.5(이번 끝 뿌리는 ×1)
  const W = {}; for (const r of endRoots) W[r] = (W[r] || 0) + 1;   // 끝 뿌리는 v0.6과 같게(겹치면 겹친 만큼)
  let added = false; for (const [r, st] of Object.entries(rootStates || {})) { const w = st?.status === 'confirmed' ? 1 : st?.status === 'likely' ? 0.5 : 0; if (w && !W[r]) { W[r] = w; added = true; } }
  if (Object.keys(W).length && alts.length) {
    const sc = th => Object.entries(W).reduce((a, [r, w]) => a + w * ((CASE.root_theory?.[r] || []).find(x => x[0] === th)?.[1] || 0), 0) + (PREF.has(th) ? CASE_CFG.prefTheory : 0) - (AVOID.has(th) ? CASE_CFG.prefTheory : 0);
    const base = sc(theory), best = alts.filter(t => t !== theory).map(t => [t, sc(t)]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= base + CASE_CFG.altMargin) { theory = best[0]; why = added ? 'root_fit_history' : 'root_fit'; }
  }
  if (theory && EX.has(theory)) {   // 기본 이론이 이 사람에게 맞지 않으면(예: 재직 중이 아닌데 잡 크래프팅) 남은 후보 중 뿌리와 가장 맞는 이론
    const sc2 = th => Object.entries(W).reduce((a, [r, w]) => a + w * ((CASE.root_theory?.[r] || []).find(x => x[0] === th)?.[1] || 0), 0) + (PREF.has(th) ? CASE_CFG.prefTheory : 0);
    const pool = [...new Set([...alts, l.default_theory, CASE.domain_theory?.[l.domain5]])].filter(t => t && !EX.has(t)).map(t => [t, sc2(t)]).sort((a, b) => b[1] - a[1]);
    if (pool.length) { theory = pool[0][0]; why = 'ctx_exclude'; }
  } else if (why === 'scene_default' && !Object.keys(W).length && alts.some(t => PREF.has(t)) && !PREF.has(theory)) { theory = alts.find(t => PREF.has(t)); why = 'ctx_prefer'; }
  // v0.14: 기본 이론이 이 사람에게 두 번 통하지 않았고(theoryAvoid) 함께 쓸 이론 중 피할 이유가 없는 것이 있으면 그쪽으로(뿌리 점수가 같거나 높을 때)
  if (theory && AVOID.has(theory) && why !== 'ctx_exclude') { const sc3 = th => Object.entries(W).reduce((a, [r, w]) => a + w * ((CASE.root_theory?.[r] || []).find(x => x[0] === th)?.[1] || 0), 0) + (PREF.has(th) ? CASE_CFG.prefTheory : 0);
    const alt = alts.filter(t => t !== theory && !AVOID.has(t)).map(t => [t, sc3(t)]).sort((a, b) => b[1] - a[1])[0]; if (alt && alt[1] >= sc3(theory)) { theory = alt[0]; why = 'task_result'; } }
  return { domain5: l.domain5 || null, career_type: l.domain5 === '진로' ? ct : null, theory: theory || null, theory_why: why };
}

/** CASE-01: 채워진 층(보기 층 + 끝 보기 뿌리 층) — '상황'은 층으로 세지 않음 */
export function layersFilled(pathOptionIds = [], endRoots = []) {
  const s = new Set();
  for (const id of pathOptionIds) { const l = CASE.option_tags[id]?.layer; if (l && l !== '상황') s.add(l); }
  for (const r of endRoots) { const l = CASE.root_layers[r]?.layer; if (PATTERN_LAYERS.includes(l) || l === '결핍') s.add(l); }
  return [...s];
}

/** 대처 방식: 고른 보기에 보이는 것(깊은 쪽 우선) → 없으면 끝 뿌리의 대처 방식 */
export function copingOf(pathOptionIds = [], endRoots = []) {
  let c = null;
  for (const id of pathOptionIds) { const t = CASE.option_tags[id]?.coping; if (t && t !== '해당 없음' && t !== '드러나지 않음') c = t; }
  if (!c) for (const r of endRoots) { const t = CASE.root_layers[r]?.coping; if (t) { c = t; break; } }
  return c;
}

/** 카드 세션 하나를 고민 상태에 반영 — path = 고른 보기 id(순서대로) · confirmed = 확인 카드 CF-A/B 또는 본인 말로 패턴을 말함 */
export function applyCardPath(cs, pathOptionIds, endRoots, { confirmed = false, rootStates = null, person = null } = {}) {
  Object.assign(cs, lensFor(cs.concern_id, pathOptionIds, endRoots, rootStates, person));
  cs.layers_filled = [...new Set([...(cs.layers_filled || []), ...layersFilled(pathOptionIds, endRoots)])];
  const pc = copingOf(pathOptionIds, endRoots); if (pc) { cs.coping = pc; cs.coping_source = 'path'; }
  if (confirmed) cs.pattern_seen = true;
  cs.stage = stageOf(cs);
  return cs;
}

/**
 * CASE-04·05: 받아들임 신호 누적. signals = 분류기 stage_signals [{id:'AC-1'|…|'FW-1'|'RS-1'…, side:'left'|'right', emotional?:bool}]
 * 한 마디로 판단하지 않음 — 같은 쪽 신호가 2번 이상(감정이 실리면 1번에 2로 셈)일 때만 단계가 바뀜
 */
export function addStageSignals(cs, signals = [], chatId = null) {
  cs.stage_signals = cs.stage_signals || {};
  for (const x of signals) {
    if (!x?.id) continue;
    const e = cs.stage_signals[x.id] || (cs.stage_signals[x.id] = { left: 0, right: 0, chats: [] });
    const side = x.id.startsWith('FW') ? 'right' : x.id.startsWith('RS') ? 'left' : (x.side === 'right' ? 'right' : 'left');
    e[side] += x.emotional ? 2 : 1;
    if (chatId && !e.chats.includes(chatId)) e.chats.push(chatId);
  }
  cs.stage = stageOf(cs);
  return cs;
}
export function stageOf(cs) {
  const S = cs.stage_signals || {}, sum = (pre, side) => Object.entries(S).filter(([k]) => k.startsWith(pre)).reduce((a, [, v]) => a + (v[side] || 0), 0);
  const left = sum('AC', 'left'), right = sum('AC', 'right'), fw = sum('FW', 'right'), resign = sum('RS', 'left');
  cs.resigned = resign >= CASE_CFG.stageMin;
  const ownWords = (cs.layers_filled || []).some(l => PATTERN_LAYERS.includes(l)) && cs.pattern_seen;
  if (!ownWords && right + left === 0) return '알아차림';
  if (cs.resigned) return '받아들임';                                        // CASE-05: 체념은 바꿔 감으로 올리지 않음
  if ((cs.fake_progress || []).some(f => f.kind === 'skip_acceptance' && !f.cleared)) return '받아들임';   // CASE-08 과잉보상: 받아들임을 건너뛰지 않음
  if (right >= CASE_CFG.stageMin && fw >= 1 && right > left) return '바꿔 감';
  if (left >= CASE_CFG.stageMin || ownWords) return '받아들임';
  return cs.stage || '알아차림';
}

/**
 * CASE-06·07: 실천 후보 고르기. candidates = [{practice_id, score?}](뿌리 실천 추천 결과) · opts.route = 'environment'(CASE-09)
 * 돌려줌: [{practice_id, stage, why}] 최대 CASE_CFG.maxTasks개 — 받아들임은 수용 1 + 통합 1
 */
/** 11-05 시뮬 5차: 장면 영역에 맞는 실천 영역(practice_area) — 연인 과제가 일 장면에, 육아 과제가 아이 없는 사람에게 가지 않게 */
const AREA_OK = { '진로': ['공통', '나', '일'], '연애': ['공통', '나', '연인', '관계'], '관계': ['공통', '나', '관계'], '자기': ['공통', '나'], '인생': ['공통', '나', '일'] };
const SCENE_AREA_PLUS = { boss_coworker: ['관계'], balance: ['관계', '육아'], wedding_prep: ['연인'], in_laws: ['연인'], spouse_roles: ['육아'], family_time: ['육아'], parenting_time: ['육아', '관계'], lonely_alone: ['관계'], love_wish: ['관계'] };
/** 11-05 새 장면: 아직 사귀는 사람이 없는 장면 — 연인 과제(다툼·커플 대화 등)를 내보내지 않음 */
const SCENE_AREA_MINUS = { love_wish: ['연인'], crush_unsure: ['연인'], dating_start: ['연인'], lonely_alone: ['연인'] };
export function areaOk(cs, practiceId, ctx = {}) {
  const a = CASE.practice_area?.[practiceId] || '공통';
  if (a === '육아' && !ctx.hasChild && !['parenting_time'].includes(cs.concern_id)) return false;
  const okSet = [...(AREA_OK[cs.domain5] || ['공통', '나']), ...(SCENE_AREA_PLUS[cs.concern_id] || [])].filter(x => !(SCENE_AREA_MINUS[cs.concern_id] || []).includes(x));
  return okSet.includes(a);
}
/**
 * 11-05 시뮬 5차: 과제 후보 — 끝 보기 뿌리(아니라고 한 뿌리는 뺌) → 없으면 지나온 보기의 갈래 뿌리(rank_roots) → 그래도 없으면 장면 1단 갈래 뿌리.
 * 상태·여건·선호로 끝났거나 모름·그만둠으로 멈춰도 과제가 0개가 되지 않게(그때는 가벼운 관찰·수용 과제 위주 — fallback 표시)
 * options = 엔진 보기 사전(choice_cards.options) · opts = { rejected: [뿌리], hasChild, intentId(v0.5: 세부 고민 id) }
 */
/** v0.17: 갈래 → 과제 후보에 쓸 뿌리. branchId = 글에서 정한 갈래 코드(모르면 null 또는 「세부 코드-0」)
 *  ① 아는 갈래: 그 갈래의 뿌리를 순서대로(주 뿌리 w 1.2 · 다음부터 0.1씩 낮게 · 1.0 밑으로는 안 내려감)
 *  ② 모르는 갈래: 기본 갈래 1~3위의 주 뿌리를 가설로(1위 1.0 · 2위 0.9 · 3위 0.8 · 같은 뿌리는 큰 값). 가설은 다른 근거가 없을 때만 과제 후보에 씀 — 카드 길의 끝 뿌리나 장부에 쌓인 뿌리가 있으면 쓰지 않고(taskCandidates), 뿌리가 확인되면 거둠(ssol_personal useRoot · useThoughtRoots)
 *  ③ 뿌리 없는 갈래: roots가 비고 rootless = true(세부 고민의 해결책으로 감)
 *  → { branch_id, known, source: 'branch' | 'default' | 'none', used: [갈래 코드…], roots: [{ root_id, w, from, first_concept_id }], rootless } · 그 세부 고민에 갈래가 없으면 null */
/** v0.19(11-23 · CSO · DB v5.32): ① 휴먼 세션용 실천도 고름(CASE_CFG.humanOnly=false · 결핍 따로 다루기를 풂 — 규칙 CASE-03-1123B)
 *  ② 결과형 뿌리 → 앞서는 원인 뿌리(sw_ob_root_causes · 규칙 ROOT-CAUSE-1123): taskCandidates 결과에 cause_roots · pickTasks(…, { causeRoots })가 모자란 과제를 채울 때 갈래 뿌리 다음으로 씀 · 확인 전이라 후보 점수로는 겨루지 않음(확인된 뿌리 실천을 밀어내지 않게) */
export function causeRoots(rootId) { return (CASE.root_causes?.[rootId] || []).slice(); }
export const BRANCH_CFG = { known: 1.2, knownStep: 0.1, knownMin: 1.0, defaults: [1.0, 0.9, 0.8], conceptBonus: 0.2 };
export function branchPlan(intentId, branchId = null, ruledOut = []) {
  const list = CASE.sub_branches?.[intentId]; if (!list || !list.length) return null;
  const rej = new Set(ruledOut || []), b = branchId && !/-0$/.test(branchId) ? list.find(x => x.branch_id === branchId) : null;
  if (b) { const roots = b.roots.filter(r => !rej.has(r.root_id)).map((r, i) => ({ root_id: r.root_id, w: Math.max(BRANCH_CFG.knownMin, +(BRANCH_CFG.known - BRANCH_CFG.knownStep * i).toFixed(2)), from: b.branch_id, first_concept_id: r.first_concept_id || null }));
    return { branch_id: b.branch_id, known: true, source: 'branch', used: [b.branch_id], roots, rootless: !b.roots.length, actions: b.roots.find(r => !rej.has(r.root_id) && (r.first_actions || []).length)?.first_actions || [] }; }
  const m = new Map(), used = [];
  list.filter(x => x.is_default).slice(0, 3).forEach((x, i) => { used.push(x.branch_id); const r = x.roots.find(y => !rej.has(y.root_id)); if (!r) return; const w = BRANCH_CFG.defaults[i] ?? 0.8;
    if (!m.has(r.root_id)) m.set(r.root_id, { root_id: r.root_id, w, from: x.branch_id, first_concept_id: r.first_concept_id || null }); });
  return { branch_id: `${intentId}-0`, known: false, source: used.length ? 'default' : 'none', used, roots: [...m.values()], rootless: !m.size };
}
let _CP = null, _CPsrc = null;
function conceptPractices(cid) { if (_CPsrc !== CASE.practice_theory) { _CP = {}; _CPsrc = CASE.practice_theory; for (const [pid, t] of Object.entries(CASE.practice_theory || {})) if (t.concept) (_CP[t.concept] = _CP[t.concept] || []).push(pid); for (const k of Object.keys(_CP)) _CP[k].sort(); } return _CP[cid] || []; }
export function taskCandidates(pathOptionIds = [], options = {}, opts = {}) {
  const rej = new Set([...(opts.rejected || []), ...(opts.ruledOut || [])]);   // v0.14: 겨루는 가설에서 아니라고 한 뿌리(cs.ruled_out)도 뺌
  const end = options[pathOptionIds.at(-1)];
  let roots = (end?.roots || []).filter(r => (r.link || 'support') !== 'goal').map(r => r.root).filter(r => !rej.has(r)), fallback = false;
  if (!roots.length) { fallback = true; for (const id of [...pathOptionIds].reverse()) { const rr = (options[id]?.rank_roots || []).filter(r => !rej.has(r)); if (rr.length) { roots = rr.slice(0, 3); break; } } }
  // v0.14(11-15): 카드 길이 없는 자유 대화 — 장부에 쌓인 상위 뿌리(opts.roots = ssol_personal.freeTalkRoots)를 끝 뿌리처럼 씀(추측이 아니라 쌓인 근거라 fallback 아님)
  let fromStates = false; if (!pathOptionIds.length && (opts.roots || []).length) { roots = opts.roots.filter(r => !rej.has(r)).slice(0, 3); fallback = !roots.length; fromStates = roots.length > 0; }
  const ids = new Set((end?.practice?.candidates || []).map(c => c.practice_id));
  for (const r of roots) for (const x of (CASE.root_practices?.[r] || [])) if (x.audience !== 'child' || opts.hasChild) ids.add(x.practice_id);
  // 11-05 v3.5: 지나온 보기의 갈래 뿌리 전부 — 같은 단계 과제를 더 찾을 때 이 뿌리에 이어진 실천을 먼저 씀(pickTasks opts.relRoots)
  const cands = [...ids].map(id => ({ practice_id: id, score: 1 }));
  // v0.17(11-23): 갈래를 봄 — 세부 고민이 정해졌으면 그 갈래(모르면 기본 갈래 1~3위)의 뿌리 실천을 후보에. 아는 갈래는 추측이 아니라 글에 나온 까닭이라 fallback을 끔
  let hypo = [];
  const plan = opts.intentId ? branchPlan(opts.intentId, opts.branchId || null, [...rej]) : null; const hadEvidence = roots.length > 0;
  const addBranch = () => { const at = new Map(cands.map(c => [c.practice_id, c]));
    const mark = (c, i) => { if (plan.known && (c.branch_ord == null || i < c.branch_ord)) c.branch_ord = i; };   // 아는 갈래의 몇째 뿌리에 이어진 실천인지(pickTasks의 갈래 한 자리가 씀)
    plan.roots.forEach((r, i) => { for (const x of (CASE.root_practices?.[r.root_id] || [])) { if (x.audience === 'child' && !opts.hasChild) continue;
      const sc = +(r.w + (r.first_concept_id && CASE.practice_theory?.[x.practice_id]?.concept === r.first_concept_id ? BRANCH_CFG.conceptBonus : 0)).toFixed(2), c = at.get(x.practice_id);
      if (c) { if (sc > c.score) { c.score = sc; c.branch_id = r.from; } mark(c, i); } else { const n = { practice_id: x.practice_id, score: sc, from: 'branch', branch_id: r.from }; mark(n, i); cands.push(n); at.set(x.practice_id, n); } } });
    // 이 갈래에서 먼저 쓰는 개념(first_concept_id)의 실천은 그 뿌리에 이어져 있지 않아도 후보에 — 1~3위 주 뿌리가 같은 세부 고민을 개념으로 가르기 위함(아는 갈래에서만)
    if (plan.known) plan.roots.forEach((r, i) => { if (r.first_concept_id) for (const pid of conceptPractices(r.first_concept_id)) { const sc = +(r.w + BRANCH_CFG.conceptBonus).toFixed(2), c = at.get(pid);
      if (c) { if (sc > c.score) { c.score = sc; c.branch_id = r.from; } c.branch_concept = r.first_concept_id; mark(c, i); } else { const n = { practice_id: pid, score: sc, from: 'branch', branch_id: r.from, branch_concept: r.first_concept_id }; mark(n, i); cands.push(n); at.set(pid, n); } } }); };
  if (plan) { if (plan.known) addBranch();   // 아는 갈래는 세부 고민의 해결책과 겹치면 +0.5를 받음(아래) · 모르는 갈래의 가설은 맨 뒤에 더함(겹쳐도 더 올리지 않음)
    const br = plan.roots.map(r => r.root_id);
    // 아는 갈래의 뿌리는 글에 나온 까닭이라 roots 앞에 둠 · 모르는 갈래(기본 갈래 가설)의 뿌리는 추측이라 roots에 넣지 않고(대처 방식·확인 질문이 추측을 따라가지 않게) 후보와 relRoots에만 씀
    if (plan.known && br.length) { roots = [...br, ...roots.filter(r => !br.includes(r))]; fallback = false; } else if (!hadEvidence) hypo = br; }
  // v0.19: 쓰는 뿌리가 결과형이면 앞서는 원인 뿌리를 알려 줌(cause_roots) — 원인 뿌리는 확인 전 추측이라 후보·roots·relRoots에 넣지 않음.
  //   쓰는 곳: ① pickTasks opts.causeRoots — 같은 단계 과제가 모자라 더 찾을 때 갈래 뿌리(relRoots) 다음으로 원인 뿌리 실천을 먼저 ② ssol_personal.causeQuestion — 원인 뿌리 확인 질문(예 → 장부에 들어와 제 점수를 받음)
  const causeRootsUsed = [];
  for (const r of roots) for (const cr of causeRoots(r)) { if (rej.has(cr) || roots.includes(cr) || causeRootsUsed.some(x => x.root_id === cr)) continue; causeRootsUsed.push({ root_id: cr, cause_of: r }); }
  const relRoots = [...new Set([...roots, ...hypo, ...pathOptionIds.flatMap(id => options[id]?.rank_roots || [])])].filter(r => !rej.has(r));
  // v0.5(11-10): 세부 고민(고민 문장 DB)이 정해졌으면 그 고민의 해결책(sw_ob_worry_practices — 아스트로 리포트에서 쓰인 실천 · AST 새 실천)도 후보로 더함.
  //   장면 뿌리와 겹치면 +0.5 · 고민에만 이어진 것은 0.8(장면 뿌리 실천보다 살짝 뒤) · fallback(뿌리 없는 끝)일 땐 1로 같이 봄
  const wp = opts.intentId ? (CASE.worry_practices?.[opts.intentId] || []) : [];
  for (const w of wp) { const c = cands.find(x => x.practice_id === w.practice_id); if (c) c.score += 0.5; else cands.push({ practice_id: w.practice_id, score: fallback ? 1 : 0.8, from: 'worry' }); }
  // v0.7(11-10): 부 고민(ssol_worry_match parsePick.secondary)의 해결책도 낮게 더함 — 겹치면 +0.25 · 부 고민에만 이어지면 0.5
  const ws = opts.secondaryId && opts.secondaryId !== opts.intentId ? (CASE.worry_practices?.[opts.secondaryId] || []) : [];
  for (const w of ws) { const c = cands.find(x => x.practice_id === w.practice_id); if (c) c.score += 0.25; else cands.push({ practice_id: w.practice_id, score: 0.5, from: 'worry_secondary' }); }
  const hypoUsed = !!plan && !plan.known && !hadEvidence && plan.roots.length > 0; if (hypoUsed) addBranch();   // 가설은 다른 근거(끝 뿌리·장부 뿌리)가 없을 때만
  return { roots, fallback, fromStates, relRoots, cause_roots: causeRootsUsed, intentId: opts.intentId || null, secondaryId: opts.secondaryId || null, branch: plan ? { branch_id: plan.branch_id, known: plan.known, source: plan.source, used: plan.used, roots: plan.roots.map(r => r.root_id), rootless: plan.rootless, actions: plan.actions || [], in_candidates: plan.known ? plan.roots.length > 0 : hypoUsed } : null, candidates: cands };
}

export function pickTasks(cs, candidates = [], opts = {}) {
  const want = opts.fallback && cs.stage !== '받아들임' ? '관찰' : (STAGE_TASK[cs.stage] || '관찰'), cop = cs.coping;
  const inArea = candidates.filter(c => areaOk(cs, c.practice_id, opts));
  candidates = inArea.length >= 2 ? inArea : [...inArea, ...candidates.filter(c => !inArea.includes(c) && (CASE.practice_area?.[c.practice_id] || '공통') === '공통')];
  // v0.12(11-15): 장면의 고민 이론 실천 — 후보에 없으면 낮은 점수(sceneScore)로 더함 — 끝 뿌리에 그 이론의 실천이 있으면 그쪽이 먼저고, 없을 때 이론 한 자리가 장면 실천을 씀
  if (CASE_CFG.sceneTheory && cs.theory) { const have0 = new Set(candidates.map(c => c.practice_id));
    for (const sp of (CASE.scene_practices?.[cs.concern_id] || [])) if (sp.theory === cs.theory && !have0.has(sp.practice_id)) candidates = [...candidates, { practice_id: sp.practice_id, score: CASE_CFG.sceneScore, from: 'scene' }]; }
  const deep = ['규칙·전략', '사고·감정', '행동'].find(l => (cs.layers_filled || []).includes(l));
  // v0.7(11-10): opts.personal = ssol_personal.scorer(cs, person) — 뿌리 상태·동기·몸 단계·지친 상태·과제 기록·여력 · 없으면 0
  const PERS = typeof opts.personal === 'function' ? opts.personal : () => ({ adj: 0, exclude: false });
  const ok = c => { const t = CASE.practice_tags[c.practice_id];
    if (!t) return { c, t: null, s: (c.score || 0) - 1 };                                       // 표시 없는 실천은 뒤로
    if (CASE_CFG.humanOnly && t.channel === '휴먼 세션') return null;                            // v0.19: 풂(CSO 11-23) — 다시 막으려면 humanOnly true
    if (cop && t.conflict && t.conflict.includes(cop)) return null;                               // 그 대처 방식에 해로운 과제
    if (t.stage === '통합' && t.coping_dir !== '공통' && cop && t.coping_dir !== cop) return null;  // 방향이 반대인 통합 과제
    if (t.stage === '통합' && t.coping_dir !== '공통' && !cop) return null;
    if (t.stage !== '통합' && t.coping_dir && t.coping_dir !== '공통' && cop && t.coping_dir !== cop) return null;   // v0.8: 대처 방향이 다른 관찰·수용 과제
    const th = theoryAdj(cs, c.practice_id); if (th === null) return null;                       // v0.6: 지금 이론과 충돌하는 실천
    const pr = PERS(c.practice_id); if (pr.exclude) return null;                                   // v0.7: 그 사람에게 맞지 않는 실천(ssol_personal)
    let s = (c.score || 0) + (t.layer === deep ? 0.5 : 0) + (t.coping_dir === cop ? 0.5 : 0) + th + pr.adj;
    if (opts.route === 'environment' && t.stage === '통합' && t.layer === '행동') s += 1;
    if (opts.route === 'light' && opts.formatOf) { const z = opts.formatOf(c.practice_id); if (z && (z.effort > 1 || z.max > 5)) s -= 1; }   // v0.15: 지나가는 일 — 가벼운 것 먼저
    if (cs.resigned && t.stage === '수용') s += 0.5;
    return { c, t, s }; };
  const pool = candidates.map(ok).filter(Boolean).sort((a, b) => b.s - a.s);
  const by = st => pool.filter(x => x.t?.stage === st);
  // 11-05 시뮬 5차: 늘 2개 — 단계 과제가 모자라면 가까운 단계로 채움(알아차림: 관찰 → 수용 · 받아들임: 수용+통합 → 수용+관찰 · 바꿔 감: 통합 → 수용)
  const NEXT = { '관찰': ['관찰', '수용', '통합'], '수용': ['수용', '통합', '관찰'], '통합': ['통합', '수용', '관찰'] };
  let out = [];
  if (cs.stage === '받아들임' && !opts.fallback) out = [by('수용')[0], by('통합')[0] || by('관찰')[0]].filter(Boolean);               // CASE-07
  else if (opts.route === 'environment') out = [pool.find(x => x.t?.stage === '통합' && x.t?.layer === '행동'), ...by(want)].filter(Boolean);   // CASE-09: 환경 쪽 대처 하나
  else out = by(want).slice(0, CASE_CFG.maxTasks);
  // 11-05: 단계 과제가 모자라면 먼저 같은 단계 과제를 전체 실천에서 더 찾음(장면 영역·대처 방식·채워진 층이 맞는 것 · 휴먼 세션 제외)
  if (out.length < CASE_CFG.maxTasks) {
    const need = cs.stage === '받아들임' && !opts.fallback ? (out.some(x => x.t?.stage === '통합') ? '수용' : '통합') : want;   // 받아들임: 수용 1 + 통합 1을 먼저 맞춤
    const have = new Set(pool.map(x => x.c.practice_id));
    // v3.5: 갈래 뿌리(relRoots)에 이어진 실천 먼저 · 그다음 같은 층 · 나머지는 고민(장면)마다 다르게 섞음(늘 같은 실천이 채워지지 않게)
    const rel = new Set((opts.relRoots || []).flatMap(r => (CASE.root_practices?.[r] || []).map(x => x.practice_id)));
    const cau = new Set((opts.causeRoots || []).flatMap(r => (CASE.root_practices?.[r] || []).map(x => x.practice_id)));   // v0.19: 결과형 뿌리의 앞서는 원인 뿌리 — 갈래 뿌리 다음
    const seed = String(cs.concern_id || '') + (opts.relRoots || []).join(',');
    const spread = id => { let h = 2166136261; for (const ch of seed + id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
    const extra = Object.entries(CASE.practice_tags || {}).filter(([id, t]) => !have.has(id) && t.stage === need && !(CASE_CFG.humanOnly && t.channel === '휴먼 세션') && (t.coping_dir === '공통' || t.coping_dir === cop) && !(cop && t.conflict && t.conflict.includes(cop)) && areaOk(cs, id, opts) && (CASE.practice_area?.[id] || '공통') !== '공통' || false)
      .concat(Object.entries(CASE.practice_tags || {}).filter(([id, t]) => !have.has(id) && t.stage === need && !(CASE_CFG.humanOnly && t.channel === '휴먼 세션') && t.coping_dir === '공통' && (CASE.practice_area?.[id] || '공통') === '공통'))
      .filter(([id, t]) => theoryAdj(cs, id) !== null && !PERS(id).exclude && !(t.stage !== '통합' && t.coping_dir && t.coping_dir !== '공통' && cop && t.coping_dir !== cop))
      .sort((a, b) => (rel.has(b[0]) - rel.has(a[0])) || (cau.has(b[0]) - cau.has(a[0])) || (((theoryAdj(cs, b[0]) || 0) + PERS(b[0]).adj) - ((theoryAdj(cs, a[0]) || 0) + PERS(a[0]).adj)) || ((b[1].layer === deep) - (a[1].layer === deep)) || (spread(a[0]) - spread(b[0])));
    for (const [id, t] of extra) { if (out.length >= CASE_CFG.maxTasks) break; if (!out.some(x => x.c.practice_id === id)) out.push({ c: { practice_id: id, score: 0 }, t, s: 0, extra: true }); }
  }
  for (const st of NEXT[want]) for (const x of by(st)) { if (out.length >= CASE_CFG.maxTasks) break; if (!out.includes(x)) out.push(x); }
  for (const x of pool) { if (out.length >= CASE_CFG.maxTasks) break; if (!out.includes(x)) out.push(x); }
  out = [...new Set(out)];
  // v0.7(11-10): 두 과제가 같은 형식(글·몸·말·생각·행동)이면, 점수 차 formatGap 안의 같은 단계 다른 형식 과제로 둘째를 바꿈(opts.formatOf = ssol_personal.sizeOf)
  if (opts.formatOf && out.length >= 2) {
    const F = id => opts.formatOf(id)?.format || null, [a, b] = out;
    if (F(a.c.practice_id) && F(a.c.practice_id) === F(b.c.practice_id)) {
      const alt = pool.find(x => !out.includes(x) && x.t?.stage === b.t?.stage && F(x.c.practice_id) && F(x.c.practice_id) !== F(a.c.practice_id) && x.s >= (b.s || 0) - CASE_CFG.formatGap);
      if (alt) out[1] = alt;
    }
  }
  // v0.8(11-10): 알아차림 단계에서 대처 방식을 알면 둘 중 하나는 그 대처 방식을 알아차리는 관찰 과제(스키마 치료 · 대처 방식 알아차림이 첫걸음)
  // v0.10(11-14): 받아들임 = 그 대처 방식을 받아들이는 수용 과제 1 · 바꿔 감 = 그 대처 방식 방향의 통합 과제 1(CASE_CFG.copingAllStages)
  const cStage = STAGE_TASK[cs.stage] || '관찰', obs = cs.stage === '알아차림';
  const fits = id => obs ? (CASE.coping_fit?.[id] || []).includes(cop) : (CASE.practice_tags[id]?.stage === cStage && CASE.practice_tags[id]?.coping_dir === cop);
  if (CASE_CFG.copingObserve && (obs || CASE_CFG.copingAllStages) && cop && !out.some(x => fits(x.c.practice_id))) {
    const F = id => opts.formatOf?.(id)?.format || null, f0 = out[0] ? F(out[0].c.practice_id) : null;
    const seed = String(cs.concern_id || '') + (opts.relRoots || []).join(',');
    const spread = id => { let h = 2166136261; for (const ch of seed + id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
    const inPool = new Map(pool.map(x => [x.c.practice_id, x]));
    const cand = Object.keys(obs ? (CASE.coping_fit || {}) : (CASE.practice_tags || {})).filter(id => fits(id) && CASE.practice_tags[id]?.stage === cStage && !(CASE_CFG.humanOnly && CASE.practice_tags[id]?.channel === '휴먼 세션') && areaOk(cs, id, opts) && theoryAdj(cs, id) !== null && !PERS(id).exclude && !out.some(x => x.c.practice_id === id))
      .map(id => ({ id, s: (inPool.get(id)?.s ?? 0) + (inPool.has(id) ? 1 : 0) + CASE_CFG.copingTheory * (theoryAdj(cs, id) || 0) + PERS(id).adj + (F(id) && F(id) !== f0 ? 0.2 : 0) + 0.5 * spread(id) }))
      .sort((a, b) => b.s - a.s);
    if (cand.length) { const id = cand[0].id, x = inPool.get(id) || { c: { practice_id: id, score: 0 }, t: CASE.practice_tags[id], s: cand[0].s, coping: true };
      const same = out.findIndex(y => y.t?.stage === cStage);   // 받아들임(수용 1 + 통합 1)에서는 수용 자리를 바꿈
      if (out.length < CASE_CFG.maxTasks) out.push(x); else out[!obs && cs.stage === '받아들임' && same >= 0 ? same : CASE_CFG.maxTasks - 1] = x; }
  }
  // v0.11(11-15): 이론 한 자리 — 둘 다 고민 이론과 다르고, 후보(뿌리·세부 고민에 이어진 실천) 안에 그 이론의 이 단계 실천이 있으면 대처 방식 자리가 아닌 쪽을 바꿈
  const thOk = id => { const t = CASE.practice_theory?.[id]; return !!cs.theory && !!t && (t.main === cs.theory || !!t.strong?.includes(cs.theory)); };
  if (CASE_CFG.theorySlot && cs.theory && out.length && !out.some(x => thOk(x.c.practice_id))) {
    const allowT = cs.stage === '알아차림' ? ['관찰'] : cs.stage === '받아들임' ? ['수용', '통합'] : ['통합'];
    const keepC = out.findIndex(x => cop && fits(x.c.practice_id));
    const i = out.length < CASE_CFG.maxTasks ? out.length : (keepC === 0 ? 1 : 0);
    const other = out.length >= CASE_CFG.maxTasks ? out[1 - i] : out[0];
    const need = cs.stage === '받아들임' && other ? (other.t?.stage === '수용' ? ['통합', '수용'] : ['수용', '통합']) : allowT;   // 받아들임의 수용 1 + 통합 1을 지킴
    const tx = pool.filter(x => thOk(x.c.practice_id) && need.includes(x.t?.stage) && !out.includes(x)).sort((a, b) => (need.indexOf(a.t.stage) - need.indexOf(b.t.stage)) || (b.s - a.s))[0];
    if (tx) out[i] = tx;
  }
  // v0.13(11-15): 대처 방식 자리가 없는 길(대처 방식을 모르거나 맞는 과제가 없음)은 남은 한 자리도 고민 이론의 같은 단계 실천으로(있을 때만 · 형식이 다른 것 먼저)
  if (CASE_CFG.theoryBoth && cs.theory && out.length === 2 && out.some(x => thOk(x.c.practice_id)) && !out.some(x => cop && fits(x.c.practice_id))) {
    const j = out.findIndex(x => !thOk(x.c.practice_id));
    if (j >= 0) { const F = id => opts.formatOf ? (opts.formatOf(id)?.format || null) : null, f0 = F(out[1 - j].c.practice_id);
      const tx = pool.filter(x => thOk(x.c.practice_id) && x.t?.stage === out[j].t?.stage && !out.includes(x)).sort((a, b) => ((F(a.c.practice_id) === f0) - (F(b.c.practice_id) === f0)) || (b.s - a.s))[0];
      if (tx) out[j] = tx; }
  }
  // v0.9(11-10): 이어 가기 한 자리 — 사다리 후보(다 한 묶음의 다음 단계 · 못 한 묶음의 한 단계 아래 · 다른 형식 판)가 있으면 둘 중 하나는 그 과제(대처 방식 관찰 자리는 그대로 둠)
  if (CASE_CFG.ladderSlot && !out.some(x => x.c.ladder)) {
    const allow = cs.stage === '알아차림' ? ['관찰'] : cs.stage === '받아들임' ? ['수용', '통합', '관찰'] : ['통합', '수용'];
    const lx = pool.filter(x => x.c.ladder && allow.includes(x.t?.stage) && !out.includes(x)).sort((a, b) => (allow.indexOf(a.t.stage) - allow.indexOf(b.t.stage)) || (b.s - a.s))[0];
    if (lx) { const keep = out.findIndex(x => cop && fits(x.c.practice_id)); const i = out.length < CASE_CFG.maxTasks ? out.length : (keep === CASE_CFG.maxTasks - 1 ? 0 : CASE_CFG.maxTasks - 1); out[i] = lx; }
  }
  // v0.15(11-16): 지나가는 일로 본 길 — 여건·상태·선호 뿌리(opts.conditionRoot)의 실천이 하나는 꼭 들어가게(환경 쪽 행동 자리는 그대로 둠)
  if (opts.conditionRoot && out.length) { const linked = id => (CASE.root_practices?.[opts.conditionRoot] || []).some(x => x.practice_id === id);
    if (!out.slice(0, CASE_CFG.maxTasks).some(x => linked(x.c.practice_id))) { const tx = pool.filter(x => linked(x.c.practice_id) && !out.includes(x))[0];
      if (tx) { const env = out.findIndex(x => opts.route === 'environment' && x.t?.stage === '통합' && x.t?.layer === '행동'); const i = out.length < CASE_CFG.maxTasks ? out.length : (env === CASE_CFG.maxTasks - 1 ? 0 : CASE_CFG.maxTasks - 1); out[i] = tx; } } }
  // v0.17(11-23 · CSO: 갈래를 보고 과제를 고름): 갈래 한 자리 — 글에서 정한 갈래의 뿌리(또는 그 갈래에서 먼저 쓰는 개념)의 실천이 하나는 꼭 들어가게.
  //   후보에 branch_ord(아는 갈래의 몇째 뿌리인지 · taskCandidates가 붙임)가 있을 때만. 먼저 쓰는 개념의 실천 → 주 뿌리 → 다음 뿌리 순 · 대처 방식 자리는 그대로 · 받아들임의 수용 1 + 통합 1은 같은 단계끼리 바꿈
  if (CASE_CFG.branchSlot !== false && pool.some(x => x.c.branch_ord != null) && out.length) { const top = out.slice(0, CASE_CFG.maxTasks);
    const bk = x => (x.c.branch_concept ? 0 : 1) * 10 + x.c.branch_ord, wantC = pool.some(x => x.c.branch_concept);
    const wantNow = wantC && pool.some(x => x.c.branch_concept && (cs.stage === '알아차림' ? ['관찰', '수용'] : cs.stage === '받아들임' ? ['수용', '통합', '관찰'] : ['통합', '수용']).includes(x.t?.stage));   // 이 단계에 쓸 수 있는 그 개념의 실천이 있을 때만 개념을 고집
    if (!top.some(x => wantNow ? x.c.branch_concept : x.c.branch_ord != null)) { const allow = cs.stage === '알아차림' ? ['관찰', '수용'] : cs.stage === '받아들임' ? ['수용', '통합', '관찰'] : ['통합', '수용'];
      const bx = pool.filter(x => (wantNow ? x.c.branch_concept : x.c.branch_ord != null) && allow.includes(x.t?.stage) && !top.includes(x)).sort((a, b) => (allow.indexOf(a.t.stage) - allow.indexOf(b.t.stage)) || (bk(a) - bk(b)) || (b.s - a.s))[0];
      if (bx) { const keep = top.findIndex(x => cop && fits(x.c.practice_id)), same = top.findIndex((x, n) => n !== keep && x.t?.stage === bx.t?.stage && x.c.branch_ord == null), notB = top.findIndex((x, n) => n !== keep && x.c.branch_ord == null);
        const i = top.length < CASE_CFG.maxTasks ? top.length : same >= 0 ? same : notB >= 0 ? notB : (keep === CASE_CFG.maxTasks - 1 ? 0 : CASE_CFG.maxTasks - 1); out[i] = bx; } } }
  return out.slice(0, CASE_CFG.maxTasks).map(x => ({ practice_id: x.c.practice_id, stage: x.t?.stage || null, coping_dir: x.t?.coping_dir || null,
    theory: CASE.practice_theory?.[x.c.practice_id]?.main || null, theory_match: !!cs.theory && (CASE.practice_theory?.[x.c.practice_id]?.main === cs.theory || !!CASE.practice_theory?.[x.c.practice_id]?.strong?.includes(cs.theory)), concept: CASE.practice_theory?.[x.c.practice_id]?.concept || null,
    why: x.t ? `${cs.stage} 단계 → ${x.t.stage} 과제${x.t.coping_dir !== '공통' ? ` · ${x.t.coping_dir} 방향` : ''}${cop && cs.stage === '알아차림' && (CASE.coping_fit?.[x.c.practice_id] || []).includes(cop) ? ` · ${cop} 대처 알아차림` : ''}` : '표시 없음',
    personal: opts.personal ? PERS(x.c.practice_id).reasons : undefined, ladder: x.c.ladder || undefined, from: x.c.from || undefined, branch_id: x.c.branch_ord != null ? x.c.branch_id || null : undefined, branch_concept: x.c.branch_concept || undefined }));
}

/** CASE-08: 가짜 진전 의심(기록만 · 판정 아님). task = sw_user_tasks 행 · said = {overdid?:bool, resign_after?:bool} */
export function checkFakeProgress(cs, tasks = [], said = {}) {
  cs.fake_progress = cs.fake_progress || [];
  const mine = tasks.filter(t => t.concern_id === cs.concern_id && t.practice_id);
  const last2 = mine.slice(-2);
  const add = kind => { if (!cs.fake_progress.some(f => f.kind === kind && !f.cleared)) cs.fake_progress.push({ kind, at: new Date().toISOString() }); };
  if (cs.coping === '회피' && cs.stage === '알아차림' && last2.length === 2 && last2.every(t => t.result === '못 함')) add('avoid_stuck');
  if (cs.coping === '굴복' && said.resign_after) add('resign_stuck');
  if (cs.coping === '과잉보상' && said.overdid) add('skip_acceptance');
  cs.stage = stageOf(cs);
  return cs.fake_progress.filter(f => !f.cleared);
}

/**
 * CASE-03: 결핍 추측. states = 뿌리 상태(ssol_root_state) · ownWords = {결핍 뿌리: 사용자의 말(원문)} — 분류기가 결핍을 자기 말로 표현했다고 본 것
 * 같은 결핍을 지키는 규칙·전략 뿌리가 서로 다른 장면에서 2번 이상 확인(또는 결핍 추측 사건) + 본인 말 → 휴먼 세션 안내
 */
export function deficitHypotheses(userId, states = {}, ownWords = {}, prev = []) {
  const P = Object.fromEntries(prev.map(r => [r.deficit_root_id, r])), out = [];
  const defs = Object.entries(CASE.root_layers).filter(([, v]) => v.layer === '결핍').map(([k]) => k);
  for (const d of defs) {
    const rules = Object.entries(CASE.root_layers).filter(([, v]) => (v.deficit_link || []).includes(d)).map(([k]) => k);
    const scenes = new Set(); const used = new Set();
    for (const r of rules) for (const sc of (states[r]?.confirm_scope || [])) { scenes.add(sc.module || sc.option_id?.split('-')[1]); used.add(r); }
    for (const e of (states[d]?.ledger || [])) if (e.validity === 'active' && e.meta?.deficit) scenes.add(e.meta.scene);
    if (!scenes.size && !ownWords[d] && !P[d]) continue;
    const row = { user_id: userId, deficit_root_id: d, rule_roots: [...used], scenes: [...scenes].filter(Boolean), own_words: !!(ownWords[d] || P[d]?.own_words),
      user_phrase: ownWords[d] || P[d]?.user_phrase || null, status: P[d]?.status || '추측', human_suggested_at: P[d]?.human_suggested_at || null };
    row.suggest_human = row.status !== '휴먼 안내함' && row.scenes.length >= 2 && row.own_words;
    out.push(row);
  }
  return out;
}
export function markHumanSuggested(row, at = new Date().toISOString()) { return { ...row, status: '휴먼 안내함', human_suggested_at: at, suggest_human: false }; }

/** CASE-10: 과제 기록(sw_user_tasks) */
export function taskOffered(userId, chatId, cs, offered, at = new Date().toISOString()) {
  return { user_id: userId, chat_id: chatId, concern_id: cs.concern_id, offered: offered.map(x => x.practice_id || x), practice_id: null,
    stage_at: cs.stage, coping_at: cs.coping, path: null, result: null, result_chat_id: null, result_at: null, at };
}
export function taskChosen(row, practiceId, path = null) { return { ...row, practice_id: practiceId, path }; }
/** 결과 = '다 함' | '조금' | '못 함'. 노력을 먼저 인정(조금도 노력으로 봄) */
export function taskResult(row, result, chatId, at = new Date().toISOString()) {
  const ack = result === '다 함' ? 'did' : result === '조금' ? 'effort' : 'no_blame';
  return { row: { ...row, result, result_chat_id: chatId, result_at: at }, ack };
}
/** 다음 대화 첫마디(서버가 쓰는 고정 문장) — 고르고 결과가 없는 가장 최근 과제가 있으면 */
export function openingFor(tasks = []) {
  const t = [...tasks].reverse().find(x => x.practice_id && !x.result);
  return t ? { type: 'task_followup', task: t, text: '다시 오셨네요! 지난번에 고른 거, 해 보니 어땠어요?', options: ['다 했어요', '조금 했어요', '못 했어요'] } : null;
}
/** RC-21: 최근 추천 갈래(최신이 끝) — ssol_motive.pathBalance의 recentPaths */
export function recentPaths(tasks = [], n = 7) { return tasks.filter(t => t.path).slice(-n).map(t => t.path); }

export function concernStateToRow(cs) {
  const { user_id, concern_id, domain5, theory, career_type, stage, coping, layers_filled, stage_signals, fake_progress } = cs;
  return { user_id, concern_id, domain5, theory, career_type, stage, coping, layers_filled, stage_signals: { ...stage_signals, _meta: { pattern_seen: !!cs.pattern_seen, coping_source: cs.coping_source || null, ruled_out: cs.ruled_out || [] } }, fake_progress };
}
export function concernStateFromRow(r) {
  const ss = { ...(r.stage_signals || {}) }; const meta = ss._meta || {}; delete ss._meta;
  return { ...r, stage_signals: ss, layers_filled: r.layers_filled || [], fake_progress: r.fake_progress || [], pattern_seen: !!meta.pattern_seen, coping_source: meta.coping_source || null, ruled_out: meta.ruled_out || [] };
}

/** CASE-12(11-05): 예측·상대 마음 질문에 쏘웰라가 쓰는 고정 문장 — 처음(first) · 다시 물을 때(again) · 카드 뒤(after_card). n = 같은 대화에서 몇 번째인지 */
export function redirectLine(qtype, n = 1, stageKey = null) {
  if (!CASE_CFG.redirectTypes.includes(qtype)) return null;   // v0.16(CSO 11-18): 예측·상대 마음·결정 질문에 답해도 됨 — 기본으로 돌리지 않음
  const step = stageKey || (n <= 1 ? 'first' : 'again');
  const L = (CASE.redirect_lines || []).filter(x => x.qtype === qtype && x.step === step);
  return L.length ? L[(n - 1) % L.length].text : null;
}
