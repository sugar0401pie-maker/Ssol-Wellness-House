// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v2.7/ssol_db_loader_v0.10.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
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
