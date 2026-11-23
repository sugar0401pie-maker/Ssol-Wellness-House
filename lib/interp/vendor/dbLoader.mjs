// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.31/ssol_db_loader_v0.34.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * v0.22(11-16): personalDataFromDb에 end_conditions(sw_ob_end_conditions — 끝 뿌리 없는 끝 보기의 갈 곳)
 * v0.21(11-15): caseDataFromDb에 scene_practices(sw_ob_scene_practices — 장면의 고민 이론 실천)
 * v0.20(11-15): 실천 ↔ 이론 strong(보조 · 잘 맞음) · personalDataFromDb에 root_predictions · condition_questions · in_session · root_layer · root_check
 * v0.19(11-14): personalDataFromDb에 first_step_rules(sw_ob_first_step_rules)
 * v0.18(11-10): personalDataFromDb에 codes · ladder · alt · lexicon · ctx · 갈래(path) · outcomeStatsFromRows(sw_stats_practice_weekly)
 * v0.17(11-10): caseDataFromDb에 coping_fit(대처 방식 관찰) · personalDataFromDb에 coping_questions
 * v0.16(11-10): personalDataFromDb(개인 맞춤 — 실천 크기·형식 · 장면 맥락 · 실천 표시 · 맞지 않는 실천 · 반대 짝 · 검수 상태)
 * 쏘웰라 엔진 데이터 — DB 표 → setData() 형식 v0.3 (2026-10-20 · 검사별 심리테스트 표 · 아스트로 같은 보기 두 답) — ESM
 * 운영 서버는 아래 표를 읽어 이 함수에 넘기고, 결과를 RS.setData(out.rootState)에 넣음. JSON 파일은 쓰지 않음.
 *   sw_ob_test_bands · sw_ob_test_domains · sw_ob_test_root_pairs · sw_ob_test_root_cues
 *   sw_ob_astro_cues · sw_ob_astro_cue_hyps · sw_ob_astro_sign_element · sw_ob_astro_statements
 *   sw_ob_root_discriminators · sw_ob_node_polarity · sw_ob_option_axes(view) · sw_ob_dessert_types
 * 값 형식: jsonb는 객체·문자열 모두 받음, numeric은 문자열로 와도 숫자로 바꿈(pg 기본 동작 대비)
 */
const J = v => (v == null || v === '' ? null : typeof v === 'string' ? JSON.parse(v) : v);
const N = v => (v == null || v === '' ? null : Number(v));
const L = v => (Array.isArray(v) ? v : String(v || '').split(',').map(x => x.trim()).filter(Boolean));
const by = (rows, f) => [...(rows || [])].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));

/** 검사별 표 { instrument: 표 } — instrument 칸이 없으면 dessert_v2 */
export function testTablesFromDb(t) {
  const inst = r => r.instrument || 'dessert_v2', out = {};
  const keys = new Set(['sw_ob_test_bands', 'sw_ob_test_domains', 'sw_ob_test_root_pairs', 'sw_ob_test_root_cues'].flatMap(k => (t[k] || []).map(inst)));
  for (const i of keys) out[i] = testTableFromDb(Object.fromEntries(['sw_ob_test_bands', 'sw_ob_test_domains', 'sw_ob_test_root_pairs', 'sw_ob_test_root_cues'].map(k => [k, (t[k] || []).filter(r => inst(r) === i)])));
  return out;
}
export function testTableFromDb({ sw_ob_test_bands, sw_ob_test_domains, sw_ob_test_root_pairs, sw_ob_test_root_cues }) {
  const domains = {};
  for (const r of by(sw_ob_test_domains, r => `${r.domain}|${String(N(r.ord)).padStart(3, '0')}`)) (domains[r.domain] = domains[r.domain] || []).push(r.factor);
  return {
    bands: by(sw_ob_test_bands, r => N(r.lo)).map(r => [r.band, N(r.lo), N(r.hi), r.label]),
    pairs: (sw_ob_test_root_pairs || []).map(r => [r.root_a, r.root_b]),
    domains,
    cues: by(sw_ob_test_root_cues, r => r.cue_id).map(r => {
      const c = { cue_id: r.cue_id, source: r.source, cond: J(r.cond_json), root_id: r.root_id, points: N(r.points), direction: r.direction, entry_hyps: L(r.entry_hyps) };
      if (r.polarity) c.polarity = r.polarity;
      if (r.note) c.note = r.note;
      return c;
    }),
  };
}
export function astroCuesFromDb({ sw_ob_astro_cues, sw_ob_astro_cue_hyps, sw_ob_astro_sign_element }) {
  const q = {};
  const opt = (qid, ans) => ((q[qid] = q[qid] || {})[ans] = q[qid][ans] || { option: null, roots: {}, hyps: [] });
  for (const r of sw_ob_astro_cues || []) { const o = opt(r.q_id, r.answer); o.option = r.option_key; o.roots[r.root_id] = N(r.points); }
  for (const r of sw_ob_astro_cue_hyps || []) opt(r.q_id, r.answer).hyps.push({ hyp: r.hyp_id, root: r.root_id, w: N(r.w) });
  return { q, sign_element: Object.fromEntries((sw_ob_astro_sign_element || []).map(r => [r.sign, r.element])), statements_index: {} };
}
export function astroStatementsFromDb({ sw_ob_astro_statements }) {
  const out = {};
  for (const r of sw_ob_astro_statements || []) {
    const roots = J(r.roots_json) || [];
    if (!roots.length) continue;                                        // 뿌리 없는 문장(실천·주의 문구 등)은 근거로 쓰지 않음
    out[r.unit_id] = { key: r.lookup_key, quote: r.chat_quote, check_q: r.check_q, roots: roots.map(x => ({ ...x, points: N(x.points) })) };
  }
  return out;
}
export function discriminatorsFromDb({ sw_ob_root_discriminators }) {
  return by(sw_ob_root_discriminators, r => r.group_id).map(r => ({ group_id: r.group_id, roots: L(r.roots), axis: r.axis, ask: r.ask,
    options: J(r.options_json), cues: J(r.cues_json), default: r.default_root, both_ok: r.both_ok }));
}
export function nodePolarityFromDb({ sw_ob_node_polarity }) { return Object.fromEntries((sw_ob_node_polarity || []).map(r => [r.node_id, r.polarity])); }
export function optionAxesFromDb({ sw_ob_option_axes }) {
  const out = {};
  for (const r of sw_ob_option_axes || []) (out[r.question_id] = out[r.question_id] || {})[r.option_key] = (J(r.axes) || [r.nov, r.soc, r.mov, r.gro, r.shr]).map(N);
  return out;
}
export function dessertTypesFromDb({ sw_ob_dessert_types }) { return Object.fromEntries((sw_ob_dessert_types || []).map(r => [r.dessert_key, r.test_type])); }

/** 온보딩 채점(ssol_onboarding_scoring.setData) — 가설·수렴 신호·계열·조합·영역 */
export function onboardingFromDb(t) {
  const ans = {};
  for (const r of t.sw_ob_astro_cues || []) { const k = `${r.q_id}|${r.option_key}`; (ans[k] = ans[k] || new Set()).add(r.answer); }
  const hypotheses = by(t.sw_ob_hypotheses, r => r.hyp_id).map(r => ({ hyp_id: r.hyp_id, question_id: r.question_id, option_key: r.option_key,
    answers: r.question_id.startsWith('astro_') ? [...(ans[`${r.question_id}|${r.option_key}`] || [])] : null, root_id: r.root_id, nature: r.nature,
    cue_weight: N(r.cue_weight), ord: Number((String(r.hyp_id).match(/-H(\d+)/) || [0, 999])[1]), signals: (J(r.cond_json) || {}).signals || [] }));
  const groups = {};
  for (const r of t.sw_ob_option_groups || []) (groups[r.group_id] = groups[r.group_id] || { question_id: r.question_id, label: r.label, keys: [] }).keys.push(r.option_key);
  const optOfPrefix = {};
  for (const h of t.sw_ob_hypotheses || []) optOfPrefix[h.hyp_id.split('-').slice(0, 2).join('-')] = [h.question_id, h.option_key];
  const combos = by(t.sw_ob_combos, r => r.combo_id).map(r => ({ id: r.combo_id, src: r.source, name: r.name, cond: J(r.cond_json), boost: J(r.boost_json),
    roots: L(r.roots), entry: L(r.entry_hyps), theory: r.theory, mod: r.modifier, sensitive: r.sensitive || '', ...(r.merge_into ? { merge_into: r.merge_into } : {}) }));   // RR-18
  return { hypotheses, groups, combos: { combos, optOfPrefix }, optionAxes: optionAxesFromDb(t), dessertTypes: dessertTypesFromDb(t),
    testDomains: (testTablesFromDb(t).dessert_v2 || { domains: {} }).domains, nodePolarity: nodePolarityFromDb(t),
    pendingOptions: (t.sw_ob_option_axes || []).filter(r => r.status === '추가 요청' || r.status === '앱에 없음(보관)').map(r => `${r.question_id}:${r.option_key}`),   // 앱에 없는 보기(CSO 10-27 F3)
    chatLinks: (t.sw_ob_hyp_chat_links || []).map(r => ({ hyp_id: r.hyp_id, cue: r.cue, link_type: r.link_type, target: r.target, match: r.match })),
    sceneSignals: (t.sw_ob_chat_link_signals || []).map(r => ({ link_target: r.link_target, signal_type: r.signal_type, signal: r.signal, match: r.match })) };   // v0.4 OB-16 · v0.10 장면·정보 칸 바꿔 읽기
}

/** 한 번에: tables = { 표 이름: 행 배열 } → { rootState: RS.setData 인자, optionAxes, dessertTypes } */
export function engineDataFromDb(tables) {
  return {
    rootState: { testTables: testTablesFromDb(tables), discriminators: discriminatorsFromDb(tables), astroCues: astroCuesFromDb(tables),
      astroStatements: astroStatementsFromDb(tables), nodePolarity: nodePolarityFromDb(tables) },
    optionAxes: optionAxesFromDb(tables), dessertTypes: dessertTypesFromDb(tables), onboarding: onboardingFromDb(tables),
  };
}
/** 서버용 SQL(표마다 select *) — service_role로 실행 */
export const ENGINE_TABLES = ['sw_ob_test_bands', 'sw_ob_test_domains', 'sw_ob_test_root_pairs', 'sw_ob_test_root_cues', 'sw_ob_astro_cues', 'sw_ob_astro_cue_hyps',
  'sw_ob_astro_sign_element', 'sw_ob_astro_statements', 'sw_ob_root_discriminators', 'sw_ob_node_polarity', 'sw_ob_option_axes', 'sw_ob_dessert_types',
  'sw_ob_hypotheses', 'sw_ob_option_groups', 'sw_ob_combos', 'sw_ob_hyp_chat_links', 'sw_ob_chat_link_signals', 'sw_ob_practice_flags', 'sw_ob_direction_axes', 'sw_ob_motive_positions', 'sw_ob_scene_domains'];

/** v0.7: 실천 표시(sw_ob_practice_flags) → { practice_id: { beyond_self, courage_why } } — 운영 실천 행에 붙여 rootBoost/pacingFilter에 넘김(RC-19·20) */
export function practiceFlagsFromDb(t) {
  const out = {};
  for (const r of t.sw_ob_practice_flags || []) {
    const o = out[r.practice_id] || (out[r.practice_id] = {});
    if (r.flag === 'beyond_self') o.beyond_self = true;
    if (r.flag === 'courage_why') o.courage_why = r.value;
    if (r.flag === 'path') o.path = r.value;
    if (r.flag === 'path2') o.path2 = r.value;
    if (r.flag.startsWith('motive_fit:')) (o.motive_fit = o.motive_fit || []).push(r.value);
  }
  return out;
}

/** v0.7: 성장 방향(제1장 G1·G3) — ssol_direction.setDirectionData에 넣을 값. claims = sw_ob_claims(kind='방향', direction 칸) · rootTexts = sw_ob_root_texts */
export function directionDataFromDb(t) {
  return { claims: (t.sw_ob_claims || []).filter(c => c.kind === '방향'), axes: t.sw_ob_direction_axes || [], rootTexts: t.sw_ob_root_texts || [], roots: (t.sw_ob_roots || []).map(r => ({ root_id: r.root_id, nature_primary: r.nature_primary })) };   // v0.10: 자원·중립 뿌리 dragged 없음
}

/** v0.9: 동기 위치(제1장 G2) — ssol_motive.setMotiveData에 넣을 값 */
export function motiveDataFromDb(t) {
  return { claims: (t.sw_ob_claims || []).filter(c => c.motive), sceneDomains: t.sw_ob_scene_domains || [], positions: t.sw_ob_motive_positions || [] };
}

/** v0.12(11-04): 장면 렌즈 함께 쓸 이론 · 뿌리-이론 점수(sw_ob_root_theory) · v0.11: 사례개념화(ssol_case.setCaseData) — 장면 렌즈 · 뿌리 층 · 보기 표시 · 실천 표시(case:*) · 단계 신호 */
export function caseDataFromDb(t) {
  const pt = {};
  for (const f of (t.sw_ob_practice_flags || [])) if (String(f.flag).startsWith('case:')) {
    const k = f.flag.slice(5), o = pt[f.practice_id] || (pt[f.practice_id] = {});
    if (k === 'conflict') o.conflict = f.note; else o[k] = f.value;
  }
  return {
    scene_lens: (t.sw_ob_scene_lens || []).map(x => ({ ...x, alt_theories: x.alt_theories ? String(x.alt_theories).split(',') : [] })),
    root_layers: Object.fromEntries((t.sw_ob_root_layers || []).map(r => [r.root_id, { layer: r.layer, coping: r.coping || null, deficit_link: r.deficit_link ? String(r.deficit_link).split(',') : [] }])),
    root_causes: rootCausesFromRows(t.sw_ob_root_causes),   // v0.34(DB v5.32): 결과형 뿌리 → 앞서는 원인 뿌리
    option_tags: Object.fromEntries((t.sw_ob_option_tags || []).map(r => [r.option_id, { layer: r.layer, coping: r.coping || null, career_type: r.career_type || null, origin_flag: !!r.origin_flag }])),
    practice_tags: pt, stage_signals: t.sw_ob_stage_signals || [],
    career_theory: { '무엇': 'TH-SDT', '어떻게': 'TH-CBT', '지금 자리': 'TH-JC' },   // 무엇 = 진로구성이론 자리(TH-CCT가 이론 DB에 들어오면 교체)
    root_theory: (t.sw_ob_root_theory || []).reduce((m, r) => ((m[r.root_id] = m[r.root_id] || []).push([r.theory_id, Number(r.score) || 0]), m), {}),
    root_practices: (t.sw_ob_root_practices || []).reduce((m, r) => ((m[r.root_id] = m[r.root_id] || []).push({ practice_id: r.practice_id, audience: r.audience || 'all' }), m), {}),   // v0.13(11-05)
    practice_area: Object.fromEntries((t.sw_ob_practice_area || []).map(r => [r.practice_id, r.area])),
    redirect_lines: (t.sw_ob_redirect_lines || []).map(r => ({ line_id: r.line_id, qtype: r.qtype, step: r.step, text: r.text })),
    practice_theory: practiceTheoryFromRows(t.sw_ob_practice_theory || []),   // v0.15(11-10)
    scene_practices: (t.sw_ob_scene_practices || []).slice().sort((a, b) => a.practice_id < b.practice_id ? -1 : 1).reduce((m, r) => ((m[r.scene_key] = m[r.scene_key] || []).push({ practice_id: r.practice_id, theory: r.theory_id, stage: r.stage }), m), {}),   // v0.21(11-15)
    worry_practices: (t.sw_ob_worry_practices || []).reduce((m, r) => ((m[r.intent_id] = m[r.intent_id] || []).push({ practice_id: r.practice_id, source: r.source, report_count: Number(r.report_count) || 0 }), m), {}),   // v0.14(11-10)
    domain_theory: { '진로': 'TH-CBT', '연애': 'TH-EFT', '관계': 'TH-ST', '자기': 'TH-WBT', '인생': 'TH-ACT' },
    coping_fit: copingFitFromRows(pt, t.sw_ob_practice_flags || []),   // v0.17(11-10)
    sub_branches: subBranchMapFromRows(t.sw_ob_sub_branches || [], t.sw_ob_sub_branch_roots || []),   // v0.32(11-23): 갈래 → 뿌리(과제 후보가 갈래를 봄)
  };
}

/** v0.32(11-23 · CSO: 엔진이 갈래를 보고 과제를 고름): sw_ob_sub_branches · sw_ob_sub_branch_roots → { 세부 고민 코드: [{ branch_id, rank, is_default, roots: [{ root_id, first_concept_id }] }] }(순위 순 · 뿌리는 순서대로) */
/** v0.33(11-23): "① … ② …" → [행동, 행동] */
export const actionsOf = t => String(t || '').split(/[①②③]/).map(x => x.trim()).filter(Boolean);
export function subBranchMapFromRows(branches = [], links = []) {
  const B = v => v === true || ['true', 't', '1'].includes(String(v).toLowerCase()), by = {};
  for (const l of [...links].sort((x, y) => Number(x.ord) - Number(y.ord))) (by[l.branch_id] = by[l.branch_id] || []).push({ root_id: l.root_id, first_concept_id: l.first_concept_id || null, first_actions: actionsOf(l.first_actions) });   // v0.33: 실제로 해 볼 행동
  const o = {};
  for (const b of [...branches].sort((x, y) => Number(x.rank) - Number(y.rank))) (o[b.sub_id] = o[b.sub_id] || []).push({ branch_id: b.branch_id, rank: Number(b.rank), is_default: B(b.is_default), roots: by[b.branch_id] || [] });
  return o;
}
/** v0.17(11-10): 대처 방식에 특히 맞는 관찰 실천 — 관찰 실천 중 대처 방향이 정해진 것 + flag coping_fit */
function copingFitFromRows(pt, flags) {
  const o = {};
  for (const [id, t] of Object.entries(pt)) if (t.stage === '관찰' && t.coping_dir && t.coping_dir !== '공통') (o[id] = o[id] || []).push(t.coping_dir);
  for (const f of flags) if (f.flag === 'coping_fit') (o[f.practice_id] = o[f.practice_id] || []).push(f.value);
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...new Set(v)].sort()]));
}
/** v0.32(11-23): + sw_ob_sub_branches · sw_ob_sub_branch_roots · sw_ob_judge_rules · sw_ob_sub_criteria · sw_ob_worry_branches.sub_branch_id
 *  v0.14(11-10): 고민 문장 DB — sw_ob_worry_intents · sw_ob_worry_utterances · sw_ob_worry_confusers · sw_ob_worry_questions · sw_ob_worry_pairs · sw_ob_worry_rules · sw_ob_worry_intensity_cues · sw_ob_worry_thoughts · sw_ob_worry_entry → ssol_worry_match.setWorryData 형식 */
export function worryDataFromDb(t) {
  const q = {}; for (const r of (t.sw_ob_worry_questions || [])) (q[r.intent_id] = q[r.intent_id] || []).push(r.question);
  return { intents: t.sw_ob_worry_intents || [], utterances: (t.sw_ob_worry_utterances || []).map(u => ({ utt_id: u.utt_id, intent_id: u.intent_id, text: u.text, q_form: u.q_form, style: u.style })),
    confusers: (t.sw_ob_worry_confusers || []).map(c => ({ conf_id: c.conf_id, intent_id: c.intent_id, text: c.text, belongs_to: c.belongs_to })), questions: q,
    // v0.23(11-17): 같은 값 짝 · 고르기 규칙 · 강도 단서
    pairs: (t.sw_ob_worry_pairs || []).map(p => ({ intent_a: p.intent_a, intent_b: p.intent_b, relation: p.relation, hint: p.hint || '' })),
    rules: (t.sw_ob_worry_rules || []).map(r => ({ rule_id: r.rule_id, kind: r.kind, applies_to: r.applies_to || '', rule: r.rule, priority: Number(r.priority) || 0 })),
    cues: (t.sw_ob_worry_intensity_cues || []).map(c => ({ cue_id: c.cue_id, kind: c.kind, pattern: c.pattern || '', word: c.word || '', min_len: c.min_len == null || c.min_len === '' ? null : Number(c.min_len), line: c.line || '', priority: c.priority == null || c.priority === '' ? 99 : Number(c.priority) })),
    // v0.24(11-17): 기저 생각 · 첫 카드 보기 먼저 보이기
    thoughts: (t.sw_ob_worry_thoughts || []).map(r => ({ intent_id: r.intent_id, surface: r.surface, first: r.first, second: r.second, status: r.status })),
    entry: (t.sw_ob_worry_entry || []).map(r => ({ intent_id: r.intent_id, card_id: r.card_id, option_ids: String(r.option_ids || '').split(',').filter(Boolean) })),
    thought_roots: (t.sw_ob_worry_thought_roots || []).map(r => ({ intent_id: r.intent_id, rank: r.rank, root_id: r.root_id, mode: r.mode })),
    branches: (t.sw_ob_worry_branches || []).map(r => ({ intent_id: r.intent_id, ord: Number(r.ord), branch_id: r.branch_id, option_id: r.option_id, sub_branch_id: r.sub_branch_id || null })),
    // v0.32(11-23): 마스터 갈래 · 판정 기준 · 판정 순서 · 갈래-뿌리 연결
    sub_branches: (t.sw_ob_sub_branches || []).map(r => ({ branch_id: r.branch_id, sub_id: r.sub_id, rank: Number(r.rank), is_default: r.is_default === true || ['true', 't', '1'].includes(String(r.is_default).toLowerCase()), sentence: r.sentence, kind: r.kind || null, when_text: r.when_text || '', clear_expr: r.clear_expr || '', versus: r.versus || '' })),
    sub_branch_roots: (t.sw_ob_sub_branch_roots || []).map(r => ({ branch_id: r.branch_id, ord: Number(r.ord), root_id: r.root_id, first_concept_id: r.first_concept_id || null, first_actions: actionsOf(r.first_actions) })),
    judge_rules: (t.sw_ob_judge_rules || []).map(r => ({ rule_id: r.rule_id, step: Number(r.step), item: r.item, rule: r.rule })),
    sub_criteria: (t.sw_ob_sub_criteria || []).map(r => ({ sub_id: r.sub_id, in_use: r.in_use === true || ['true', 't', '1'].includes(String(r.in_use).toLowerCase()), base_values: r.base_values || '', must_have: r.must_have || '', goes_elsewhere: r.goes_elsewhere || '' })),
    branch_thoughts: (t.sw_ob_worry_branch_thoughts || []).map(r => ({ option_id: r.option_id, core_thought: r.core_thought })),
    branch_cues: (t.sw_ob_worry_branch_cues || []).map(r => ({ option_id: r.option_id, cue_words: r.cue_words, pattern: r.pattern || null })) };   // v0.31   // v0.30   // v0.29(11-18): 세부 고민 → 갈래   // v0.27(11-18): 기저 생각 → 뿌리
}

/** v0.15(11-10): 실천 ↔ 이론 행 → {practice_id: {main, concept, also:[이론], conflict:[이론]}} (엔진 ssol_case v0.6가 씀) */
export function practiceTheoryFromRows(rows = []) {
  const o = {};
  for (const r of rows) { const x = o[r.practice_id] || (o[r.practice_id] = { main: null, concept: null, also: [], conflict: [], strong: [] });
    if (r.fit === '충돌') x.conflict.push(r.theory_id); else if (r.role === '주') { x.main = r.theory_id; x.concept = r.concept_id || null; } else { x.also.push(r.theory_id); if (r.fit === '잘 맞음') x.strong.push(r.theory_id); } }
  for (const x of Object.values(o)) { x.also.sort(); x.conflict.sort(); x.strong.sort(); }   // v0.18: DB가 주는 순서와 상관없이 같게
  return o;
}

/** v0.16(11-10): 개인 맞춤(ssol_personal.setPersonalData) — sw_ob_practice_size · sw_ob_scene_context · sw_ob_practice_flags · sw_ob_root_practice_avoid · sw_ob_roots · sw_ob_practice_ref */
export function personalDataFromDb(t) {
  const B = v => v === true || ['true', 't', '1'].includes(String(v).toLowerCase());
  const practice_size = {};
  for (const r of t.sw_ob_practice_size || []) practice_size[r.practice_id] = { step: r.step, min: N(r.min_minutes), max: N(r.max_minutes), effort: N(r.effort), format: r.format, exposure_step: N(r.exposure_step) || 0,
    needs: [['partner', 'needs_partner'], ['child', 'needs_care'], ['work', 'needs_work'], ['other', 'needs_other']].filter(([, c]) => B(r[c])).map(([k]) => k) };
  const practice_flags = {};
  for (const r of t.sw_ob_practice_flags || []) { const f = String(r.flag);
    if (f === 'beyond_self') (practice_flags[r.practice_id] = practice_flags[r.practice_id] || {}).beyond_self = true;
    if (f.startsWith('motive_fit:')) { const o = practice_flags[r.practice_id] = practice_flags[r.practice_id] || {}; (o.motive_fit = o.motive_fit || []).push(f.slice(11)); }
    if (f === 'path') (practice_flags[r.practice_id] = practice_flags[r.practice_id] || {}).path = r.value; }
  const SP = v => String(v || '').split(',').filter(Boolean), ctx = {};
  for (const r of t.sw_ob_ctx_options || []) (ctx[r.question_id] = ctx[r.question_id] || {})[r.option_key] = { filter: J(r.practice_filter) || {}, adjust: J(r.practice_adjust) || {}, theory: J(r.theory_rules) || {} };
  const ref = t.sw_ob_practice_ref || [];
  return { practice_size, practice_flags,
    scene_context: Object.fromEntries((t.sw_ob_scene_context || []).map(r => [r.scene_key, { cue: r.cue, who: r.who || null, where: r.where_at || null }])),
    root_avoid: (t.sw_ob_root_practice_avoid || []).map(r => `${r.root_id}|${r.practice_id}`),
    opposite: Object.fromEntries((t.sw_ob_roots || []).filter(r => r.opposite_root_id).map(r => [r.root_id, r.opposite_root_id])),
    review: Object.fromEntries(ref.map(r => [r.practice_id, r.review_status || null])), titles: Object.fromEntries(ref.map(r => [r.practice_id, r.title])),
    concept: Object.fromEntries(ref.map(r => [r.practice_id, r.main_concept || null])),
    coping_questions: (t.sw_ob_coping_questions || []).map(r => ({ q_id: r.q_id, domain5: r.domain5, ask: r.ask, options: J(r.options_json) })),
    codes: Object.fromEntries((t.sw_ob_practice_codes || []).map(r => [r.practice_id, { values: SP(r.values_q4), hobbies: SP(r.hobbies_q5), weekends: SP(r.weekends_q6), focus: SP(r.focus_q7), exclude: SP(r.exclude_q9) }])),
    ladder: Object.fromEntries((t.sw_ob_practice_ladder || []).map(r => [r.practice_id, { family: r.family, level: Number(r.level) }])),
    alt: Object.fromEntries((t.sw_ob_practice_alt || []).map(r => [r.practice_id, r.base_id])),
    lexicon: by(t.sw_ob_plan_lexicon, r => `${r.kind}${String(r.priority).padStart(4, '0')}`).map(r => ({ kind: r.kind, label: r.label, pattern: r.pattern })), ctx,
    root_predictions: Object.fromEntries((t.sw_ob_root_predictions || []).map(r => [r.root_id, r.check_question])),
    end_conditions: Object.fromEntries((t.sw_ob_end_conditions || []).map(r => [r.option_id, { route: r.route, root: r.root_id || null }])),   // v0.22
    condition_questions: by(t.sw_ob_condition_questions, r => r.q_id).map(r => ({ q_id: r.q_id, end_kind: r.end_kind, ask: r.ask, options: J(r.options_json) })),
    in_session: (t.sw_ob_practice_flags || []).filter(r => r.flag === 'in_session').map(r => r.practice_id).sort(),
    root_layer: Object.fromEntries((t.sw_ob_root_layers || []).map(r => [r.root_id, r.layer])),
    root_causes: rootCausesFromRows(t.sw_ob_root_causes),
    root_check: Object.fromEntries((t.sw_ob_root_predictions || []).filter(r => r.probe_question).map(r => [r.root_id, r.probe_question])),
    first_step_rules: by(t.sw_ob_first_step_rules, r => Number(r.priority)).map(r => ({ rule_id: r.rule_id, format: r.format, pattern: r.pattern || '', first_step: r.first_step })) };
}
/** v0.18(11-10): 사람들 전체 결과 — sw_stats_practice_weekly 행(주별)을 실천별로 더함 → ssol_personal.setOutcomeStats */
export function outcomeStatsFromRows(rows = []) {
  const o = {}; for (const r of rows) { const x = o[r.practice_id] || (o[r.practice_id] = { practice_id: r.practice_id, checked: 0, improved: 0 }); x.checked += Number(r.checked) || 0; x.improved += Number(r.improved) || 0; }
  return Object.values(o);
}

/** v0.25(11-18): 안전 신호 뒤의 응답 — sw_ob_safety_reply_tiers · sw_ob_safety_replies · sw_ob_help_resources → ssol_safety_reply.setReplyData 형식. status로 거르려면 opts.approvedOnly */
export function safetyReplyDataFromDb(t, opts = {}) {
  const ok = r => !opts.approvedOnly || String(r.status || '').startsWith('검수 완료');
  return { tiers: (t.sw_ob_safety_reply_tiers || []).map(r => ({ signal_id: r.signal_id, tier: r.tier })),
    replies: (t.sw_ob_safety_replies || []).filter(ok).map(r => ({ reply_id: r.reply_id, grp: r.grp, stage: r.stage, text: r.text })),
    resources: (t.sw_ob_help_resources || []).filter(ok).map(r => ({ res_id: r.res_id, grp: r.grp, name: r.name, contact: r.contact, hours: r.hours || '', note: r.note, url: r.url || '', sort: Number(r.sort) || 0 })) };   // v0.26: url(마들랜 카카오톡)
}

/** v0.28(11-18): 리포트와 이어진 말에 답하기 — sw_ob_report_cues · sw_ob_theory_lines → ssol_report_reply.setReportReplyData */
export function reportReplyDataFromDb(t = {}) {
  return { cues: (t.sw_ob_report_cues || []).map(r => ({ cue_id: r.cue_id, source: r.source, pattern: r.pattern })),
    theories: (t.sw_ob_theory_lines || []).map(r => ({ theory_id: r.theory_id, name: r.name, name_chat: r.name_chat, line: r.line })) };
}

/** v0.34(DB v5.32): sw_ob_root_causes 줄 → { 결과형 뿌리: [원인 뿌리…](ord 순) } */
export function rootCausesFromRows(rows = []) { const m = {}; for (const r of [...(rows || [])].sort((a, b) => (+a.ord) - (+b.ord))) (m[r.result_root_id] ||= []).push(r.cause_root_id); return m; }
