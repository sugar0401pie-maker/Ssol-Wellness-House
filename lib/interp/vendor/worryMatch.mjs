// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.39/ssol_worry_match_v0.10.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 첫 말 → 세부 고민(고민 문장 DB) → 장면·해결책 v0.4 (2026-11-17)
 * v0.2: 헷갈리는 말(confusers)을 정답 쪽 예시로도 씀 · 두 후보가 가까우면 되묻는 질문(clarifyFor) · 부 고민 해결책(routeFor secondary)
 * v0.10(11-23 · CSO 두 번째 · DB v5.31): branchCard(세부 고민을 알고 들어온 사람의 첫 카드 = 마스터 갈래 문장 · 규칙 WT-07) · 갈래에서 실제로 해 볼 행동(first_actions → roots[].first_actions · branchRootCandidates.actions · 규칙 WT-08)
 * v0.9(11-23 · CSO: 마스터 파일의 갈래·판정 기준·판정 순서·갈래-뿌리 연결을 DB·엔진에 — 엔진이 갈래를 보고 과제를 고름 · DB v5.30):
 *   마스터 갈래(sub_branches — 코드 = 세부 코드-순위 · 1~3 = 기본 갈래): subBranchesFor · subBranchById · defaultBranches · subBranchPrompt → 모델 → parseSubBranch · subBranchGuess(「② 명확한 표현」 낱말 맞춤 — 예비) · branchRootCandidates
 *   routeFor에 sub_branches · default_branches · branch(글이 있으면 짐작) · branch_candidates. 과제는 ssol_case.taskCandidates(…, { intentId, branchId })가 갈래를 봄
 *   예전 카드 보기 갈래(branches)의 코드는 「세부 코드-C번호」(예: CR-MIND-C1)로 바뀜 — 마스터 갈래 코드와 겹쳐 뜻이 달랐음. 문장이 같은 것은 sub_branch_id로 이어짐. 모를 때의 코드 「세부 코드-0」은 그대로
 * v0.8(11-18 · CSO: 갈래를 세부 고민에 붙임 · 갈래 단서 말): branch_cues — branchesFor에 cue_words · branchGuess(intentId, text)(낱말 규칙으로 갈래 짐작 · 안 걸리면 세부 코드-0)
 * v0.7(11-18): 갈래 코드(branch_id · 예: CR-MIND-1 · 모르면 unknownBranch = 'CR-MIND-0') · 기저 생각이 없던 갈래에 새로 쓴 기저 생각(branch_thoughts) · branchById
 * v0.6(11-18 · CSO: 분류를 구체화해 쪼갬 — 세부 고민 → 갈래 → 카드의 기저 생각 여러 개): branches — branchesFor(intentId, cards) · routeFor.branch_options(갈래 순서 전체 · preferOptions는 앞 3개)
 * v0.5(11-18 · CSO: 기저 생각이 여러 개라는 것을 씀 · 기저 생각 → 뿌리 → 해결책): thought_roots — thoughtRoots · thoughtsFor(주·부 고민의 기저 생각 최대 4개) · thoughtCheck에 "둘 다 있어요" · thoughtPick(고른 기저 생각 → 뿌리 점수) · thoughtCandidates(답하기 전 후보 뿌리)
 * v0.4(11-17 · 타로 v3.1 · CSO 답): 기저 생각(thoughts) — thoughtLine · thoughtCheck · secondaryLine · 강도 단서 v2(10갈래 · 받아 주는 한 줄 ack · 길이) · 세부 고민에 맞는 첫 카드 보기(entry → routeFor.preferOptions)
 * v0.3(11-17 · 타로 일상고민 CSO 검토 반영): 고르기 규칙(rules)을 프롬프트에 넣음 · 같은 값 짝(pairs)은 되묻지 않고 채점에서 맞음으로 침 · 일+연애면 연애가 주 고민(prioritize) · 묻는 꼴·강도 재기(signalsOf)
 * 데이터: data/worry_v0.19.json(시험용) · 운영은 sw_ob_worry_intents · sw_ob_worry_utterances · sw_ob_worry_confusers · sw_ob_worry_questions · sw_ob_worry_pairs · sw_ob_worry_rules · sw_ob_worry_intensity_cues (ssol_db_loader worryDataFromDb)
 *
 * 흐름(제안 · 임베딩 2단계)
 *  1) 찾기: 첫 말과 예시 문장 1,748개의 비슷함 점수 → 세부 고민마다 상위 3문장 평균 → 후보 k개(rankIntents)
 *     · 운영: 임베딩 검색 점수를 넘김 rankIntents(text, { scores }) — scores = {utt_id: 비슷함} · Map · [[utt_id, 비슷함]] · [{utt_id, score}]
 *     · 점수를 안 주면 글자 2·3-gram 비교(시험용 · 미묘한 차이는 잘 못 가름)
 *  2) 고르기: 후보 k개의 정의 · 구분 단서 · 이웃과 다른 점을 분류기 프롬프트에 넣어 하나를 고름(pickPrompt → 모델 → parsePick)
 *  3) 잇기: routeFor(intent_id) → 장면 키(카드) · 장면 상태 · 해결책 실천 · 돌아보기 질문
 */
let W = { intents: [], utterances: [], confusers: [], questions: {}, pairs: [], rules: [], cues: [], thoughts: [], entry: [], thought_roots: [], branches: [], branch_thoughts: [], branch_cues: [], sub_branches: [], sub_branch_roots: [], judge_rules: [], sub_criteria: [] };
let CARD_OF = {};   // v0.10: 마스터 갈래 코드 → 문장이 같은 카드 보기(option_id)
let SB = {}, SBID = {}, SBRE = {};   // v0.9: 마스터 갈래 — 세부 코드 → [갈래…](순위 순) · 갈래 코드 → 갈래 · 「② 명확한 표현」 낱말
let BCUE = {};   // v0.8: 갈래 단서 말
let BID = {}, BROW = {}, BTH = {};   // v0.7: 갈래 코드 · 새로 쓴 기저 생각
let BR = {};   // v0.6: intent_id → [option_id …](갈래 순서)
let TR = {};   // v0.5: intent_id → { first: { root_id, mode }, second: { root_id, mode } }
let PAIR = {}, CUE = [], TH = {}, EN = {};
let BY = {}, UT = {}, VEC = null;
export const CFG = { k: 3, topN: 3, minScore: 0, useConfusers: true, clarifyGap: 0.04, loveFirst: true, strongMin: 1 };
let CONF = {}, CB = {}, CVEC = null;
export function setWorryData(d = {}) {
  W = { ...W, ...d };
  BY = Object.fromEntries((W.intents || []).map(i => [i.intent_id, i]));
  UT = {}; for (const u of W.utterances || []) (UT[u.intent_id] = UT[u.intent_id] || []).push(u);
  CONF = {}; CB = {}; for (const c of W.confusers || []) { (CONF[c.intent_id] = CONF[c.intent_id] || []).push(c); (CB[c.belongs_to] = CB[c.belongs_to] || []).push(c); }
  PAIR = {}; for (const p of W.pairs || []) { PAIR[`${p.intent_a}|${p.intent_b}`] = p; PAIR[`${p.intent_b}|${p.intent_a}`] = p; }
  CUE = (W.cues || []).map(c => ({ ...c, re: c.pattern ? new RegExp(c.pattern) : null })).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  TH = Object.fromEntries((W.thoughts || []).map(t => [t.intent_id, t])); EN = Object.fromEntries((W.entry || []).map(e => [e.intent_id, e]));
  BR = {}; for (const r of [...(W.branches || [])].sort((x, y) => x.ord - y.ord)) (BR[r.intent_id] = BR[r.intent_id] || []).push(r.option_id);
  BID = {}; BROW = {}; for (const r of W.branches || []) { const id = r.branch_id || `${r.intent_id}-C${r.ord}`; BID[`${r.intent_id}|${r.option_id}`] = id; BROW[id] = r; }
  BTH = Object.fromEntries((W.branch_thoughts || []).map(t => [t.option_id, t.core_thought]));
  BCUE = Object.fromEntries((W.branch_cues || []).map(c => [c.option_id, { cue_words: c.cue_words, re: c.pattern ? new RegExp(c.pattern) : null }]));
  TR = {}; for (const r of W.thought_roots || []) (TR[r.intent_id] = TR[r.intent_id] || {})[r.rank] = { root_id: r.root_id, mode: r.mode || 'score' };
  // v0.9: 마스터 갈래 · 갈래-뿌리 연결
  const rb = {}; for (const l of [...(W.sub_branch_roots || [])].sort((x, y) => x.ord - y.ord)) (rb[l.branch_id] = rb[l.branch_id] || []).push({ root_id: l.root_id, ord: l.ord, first_concept_id: l.first_concept_id || null, first_actions: l.first_actions || [] });
  CARD_OF = {}; for (const r of W.branches || []) if (r.sub_branch_id) CARD_OF[r.sub_branch_id] = r.option_id;
  SB = {}; SBID = {}; SBRE = {};
  for (const b of [...(W.sub_branches || [])].sort((x, y) => x.rank - y.rank)) { const o = { ...b, intent_id: b.sub_id, roots: rb[b.branch_id] || [] }; (SB[b.sub_id] = SB[b.sub_id] || []).push(o); SBID[b.branch_id] = o; }
  VEC = null; CVEC = null; return W;
}
const norm = s => String(s || '').toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎ ]/g, ' ').replace(/\s+/g, ' ').trim();
function grams(s) { const m = new Map(); for (const w of norm(s).split(' ')) { const t = ` ${w} `; for (const n of [2, 3]) for (let i = 0; i + n <= t.length; i++) { const g = t.slice(i, i + n); m.set(g, (m.get(g) || 0) + 1); } } return m; }
function cos(a, b) { let d = 0, x = 0, y = 0; for (const [g, v] of a) { x += v * v; if (b.has(g)) d += v * b.get(g); } for (const v of b.values()) y += v * v; return x && y ? d / Math.sqrt(x * y) : 0; }
/** 시험용 헷갈리는 말 점수 {conf_id: 비슷함} */
export function confuserScores(text) { CVEC = CVEC || new Map((W.confusers || []).map(c => [c.conf_id, grams(c.text)])); const q = grams(text); const o = {}; for (const [id, v] of CVEC) o[id] = cos(q, v); return o; }
/** 시험용 글자 비교 점수 {utt_id: 비슷함} — 운영에서는 임베딩 점수를 쓰세요 */
export function lexicalScores(text) { VEC = VEC || new Map((W.utterances || []).map(u => [u.utt_id, grams(u.text)])); const q = grams(text); const o = {}; for (const [id, v] of VEC) o[id] = cos(q, v); return o; }
function toObj(sc) {
  if (!sc) return null;
  if (sc instanceof Map) return Object.fromEntries(sc);
  if (Array.isArray(sc)) return Object.fromEntries(sc.map(x => Array.isArray(x) ? [x[0], x[1]] : [x.utt_id, x.score ?? x.sim ?? 0]));
  return sc;
}
/** 1) 세부 고민 후보: [{intent_id, name, topic, score, scene_key, scene_status, top:[utt_id…]}] */
export function rankIntents(text, opts = {}) {
  const sc = toObj(opts.scores) || lexicalScores(text);
  // v0.2: 헷갈리는 말(A처럼 보이지만 B인 말)은 B의 예시로도 씀 — 경계에 있는 말을 B 쪽으로 당김(confScores: 운영은 임베딩 점수 {conf_id: 비슷함})
  const cs = CFG.useConfusers ? (toObj(opts.confScores) || (opts.scores ? null : confuserScores(text))) : null;
  const out = [];
  for (const [iid, us] of Object.entries(UT)) {
    const s = us.map(u => [sc[u.utt_id] ?? 0, u.utt_id]).concat(cs ? (CB[iid] || []).map(c => [cs[c.conf_id] ?? 0, c.conf_id]) : []).sort((a, b) => b[0] - a[0]).slice(0, opts.topN || CFG.topN);
    const score = s.reduce((a, [v]) => a + v, 0) / Math.max(1, s.length);
    const i = BY[iid]; out.push({ intent_id: iid, name: i?.name, topic: i?.topic, score: +score.toFixed(4), raw: score, scene_key: i?.scene_key || null, scene_status: i?.scene_status, top: s.map(x => x[1]) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.k || CFG.k).map(({ raw, ...x }) => x);
}
/** 2) 고르기 프롬프트(분류기에 덧붙임) — 후보마다 정의 · 구분 단서 · 이웃과 다른 점 · 예시 2문장 */
export function pickPrompt(text, cands) {
  const lines = cands.map((c, n) => { const i = BY[c.intent_id] || {}; const ex = (UT[c.intent_id] || []).filter(u => c.top?.includes(u.utt_id)).slice(0, 2).map(u => `“${u.text}”`).join(' · ');
    return `${n + 1}. ${c.intent_id} ${i.name}\n   정의: ${i.definition}\n   단서: ${i.cues}\n   이웃과 다른 점: ${i.neighbor_diff}\n   예: ${ex}`; }).join('\n');
  const ids = new Set(cands.map(c => c.intent_id));
  const rl = (W.rules || []).filter(r => !r.applies_to || String(r.applies_to).split(',').some(x => ids.has(x))).sort((a, b) => (+a.priority || 0) - (+b.priority || 0)).map(r => `- ${r.rule}`).join('\n');
  const pr = []; for (const a of cands) for (const b of cands) { const p = a.intent_id < b.intent_id && PAIR[`${a.intent_id}|${b.intent_id}`]; if (p && p.relation !== 'no_ask') pr.push(`- ${p.intent_a}와 ${p.intent_b}는 ${p.relation === 'same' ? '같은 값으로 친다' : '둘 다 될 수 있다'}${p.hint ? `(${p.hint})` : ''}`); }
  const extra = (rl ? `\n고르는 기준:\n${rl}` : '') + (pr.length ? `\n가까운 짝:\n${pr.join('\n')}` : '');
  return `사용자의 첫 말이 아래 세부 고민 중 무엇에 가장 가까운지 하나만 고른다. 사용자가 주로 묻거나 느끼는 것을 기준으로 하고, 이웃과 다른 점을 꼭 비교한다. 둘이 섞여 있으면 주 고민 하나와 부 고민 하나를 적는다. 어느 것도 아니면 null.${extra}\n사용자 말: “${text}”\n후보:\n${lines}\n출력(JSON): {"intent_id":"…|null","secondary":"…|null","why":"한 줄"}`;
}
export function parsePick(raw, cands = []) {
  let o; try { o = typeof raw === 'string' ? JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) : raw; } catch { return { intent_id: cands[0]?.intent_id || null, secondary: null, fallback: 'parse' }; }
  const ok = id => id && BY[id] ? id : null;
  return { intent_id: ok(o.intent_id), secondary: ok(o.secondary), why: o.why || null };
}
/** v0.2: 1·2위가 가깝고 서로 헷갈리는 사이(이웃 설명·헷갈리는 말)면 되묻는 질문 하나 — 고르기 전에 씀 */
export function clarifyFor(cands = []) {
  const [a, b] = cands; if (!a || !b || a.score - b.score > CFG.clarifyGap) return null;
  const pp = PAIR[`${a.intent_id}|${b.intent_id}`]; if (pp && (pp.relation === 'same' || pp.relation === 'no_ask')) return null;   // v0.3: 같은 값 · 다시 묻지 않는 짝
  const linked = (CONF[a.intent_id] || []).some(c => c.belongs_to === b.intent_id) || (CONF[b.intent_id] || []).some(c => c.belongs_to === a.intent_id) || String(BY[a.intent_id]?.neighbor_diff || '').includes(b.intent_id) || String(BY[b.intent_id]?.neighbor_diff || '').includes(a.intent_id);
  if (!linked) return null;
  return { ask: `지금 마음이 ‘${a.name}’ 쪽에 더 가까워요, ‘${b.name}’ 쪽에 더 가까워요?`, options: [{ text: a.name, intent_id: a.intent_id }, { text: b.name, intent_id: b.intent_id }, { text: '둘 다예요', intent_id: 'both' }], pair: [a.intent_id, b.intent_id] };
}
/** 되묻기 답 → { intent_id, secondary } */
export function applyClarify(q, pick) { return pick === 'both' ? { intent_id: q.pair[0], secondary: q.pair[1] } : { intent_id: pick, secondary: null }; }
/** 3) 잇기: 장면(카드) · 해결책 · 질문. case 데이터의 worry_practices를 넘기면 실천도 돌려줌 · v0.2: opts.secondary = 부 고민 id */
export function routeFor(intentId, caseData = null, opts = {}) {
  const i = BY[intentId]; if (!i) return null;
  const openCards = i.scene_status === '기존 장면' && i.scene_key;
  return { intent_id: intentId, name: i.name, topic: i.topic, scene_key: openCards ? i.scene_key : null, scene_candidate: !openCards && i.scene_key ? i.scene_key : null,
    mode: openCards ? 'cards' : 'free_talk', practices: (caseData?.worry_practices?.[intentId] || []).map(x => x.practice_id), questions: W.questions?.[intentId] || [],
    intensity: opts.intensity || null, tone: opts.intensity?.level === 'strong' ? 'acknowledge_first' : null, ack: opts.intensity?.level === 'strong' ? opts.intensity.ack : null,   // v0.3: 힘듦을 먼저 짚어 줌 · v0.4: 받아 주는 한 줄
    thought: TH[intentId] ? { surface: TH[intentId].surface, first: TH[intentId].first, second: TH[intentId].second, line: thoughtLine(intentId) } : null,   // v0.4 기저 생각
    thought_roots: thoughtRoots(intentId), thought_candidates: thoughtCandidates(intentId, opts.secondary || null),   // v0.5: 기저 생각 → 뿌리
    first_card: EN[intentId]?.card_id || null, preferOptions: EN[intentId]?.option_ids || (BR[intentId] || []).slice(0, 3), branch_options: BR[intentId] || [],   // v0.6: 갈래 순서 전체   // v0.4: presentCard(…, { preferOptions })
    // v0.9(11-23): 마스터 갈래 — opts.text(첫 말)가 있으면 낱말 맞춤으로 짐작(예비) · opts.branchId(분류 모델이 정한 갈래)가 있으면 그것을 씀. taskCandidates에 { intentId, branchId: route.branch?.branch_id }로 넘김
    sub_branches: (SB[intentId] || []).map(b => b.branch_id), default_branches: defaultBranches(intentId),
    branch: (SB[intentId] || []).length ? (opts.branchId ? { branch_id: opts.branchId, known: !/-0$/.test(opts.branchId) && !!SBID[opts.branchId], hits: [] } : opts.text != null ? subBranchGuess(intentId, opts.text) : { branch_id: `${intentId}-0`, known: false, hits: [] }) : null,
    branch_candidates: branchRootCandidates(intentId, opts.branchId || (opts.text != null ? subBranchGuess(intentId, opts.text)?.branch_id : null), opts.ruledOut || []),
    secondary: opts.secondary && BY[opts.secondary] ? opts.secondary : null, secondary_practices: opts.secondary ? (caseData?.worry_practices?.[opts.secondary] || []).map(x => x.practice_id) : [] };
}
/** 시험 도우미: 문장 목록과 정답으로 1위 · 3위 안 맞힌 비율(점수 함수를 바꿔 끼울 수 있음 — 임베딩 비교용) */
export function evaluate(items, scoreFn = null, k = 3, opts = {}) {
  let t1 = 0, t3 = 0, l1 = 0, l3 = 0; const miss = {}; const eq = (x, g) => x === g || sameValue(x, g, opts.loose === 'both' ? ['same', 'both_ok'] : ['same']);
  for (const it of items) { const r = rankIntents(it.text, { scores: scoreFn ? scoreFn(it) : null, k }); const ids = r.map(x => x.intent_id);
    if (eq(ids[0], it.gold)) l1++; if (ids.some(x => eq(x, it.gold))) l3++;
    if (ids[0] === it.gold) t1++; if (ids.includes(it.gold)) t3++; else miss[`${it.gold}→${ids[0]}`] = (miss[`${it.gold}→${ids[0]}`] || 0) + 1; }
  return { n: items.length, top1: +(t1 / items.length).toFixed(3), [`top${k}`]: +(t3 / items.length).toFixed(3), top1_same: +(l1 / items.length).toFixed(3), [`top${k}_same`]: +(l3 / items.length).toFixed(3), miss };
}

/** v0.3: 두 세부가 같은 값(same)인지 — rel에 'both_ok'를 넣으면 둘 다 됨 짝도 */
export function sameValue(a, b, rel = ['same']) { const p = PAIR[`${a}|${b}`]; return !!p && rel.includes(p.relation); }
export function pairOf(a, b) { return PAIR[`${a}|${b}`] || null; }
const FORM = [['시기', /언제|몇 ?월|올해 안|내년|시기|얼마나 걸/], ['방법', /어떻게 ?(해야|하면|다가|풀)|방법/], ['결정', /할까 ?말까|해야 ?할까|해도 ?될까|할지 ?말지|맞을까|그만둘까|헤어질까|[가-힣]까 ?말까/], ['상대마음', /(저를|나를|날) ?어떻게 ?생각|속마음|마음이 ?있을까|좋아할까/], ['가능성', /될까|수 ?있을까|가능|붙을까|생길까|이어질까|잘될까/]];
const AREA = [['결혼', /결혼|남편|아내|배우자|신랑|시댁|처가/], ['연애', /연애|남친|여친|남자친구|여자친구|애인|썸|짝사랑|좋아하는 ?사람|재회|헤어|이별|고백|인연|소개팅/], ['일', /회사|직장|이직|퇴사|취업|취직|업무|면접|상사|부서|진로|알바|사업|창업/], ['시험', /시험|수능|합격|입시|자격증|공무원|대학/], ['돈', /돈|금전|주식|투자|대출|월급|로또/]];
const LOVE = new Set(['연애 시작', '짝사랑·썸', '연애 중', '이별·재회']), WORK = new Set(['이직·퇴사', '취업', '진로·방향', '사업·창작']);
/** v0.3: 첫 말에서 재는 것 — 묻는 꼴(form) · 걸친 영역(areas) · 강도(intensity: strong이면 힘듦을 먼저 짚음). 위험 판단이 아님(그건 lib/safety) · 원문은 저장하지 않고 이 값만 남김 */
export function signalsOf(text) {
  const t = String(text || ''); const form = (FORM.find(([, re]) => re.test(t)) || [null])[0]; const areas = AREA.filter(([, re]) => re.test(t)).map(x => x[0]);
  const hit = CUE.filter(c => c.re ? c.re.test(t) : (c.min_len && t.replace(/\s+/g, '').length >= c.min_len)); const kinds = [...new Set(hit.map(c => c.kind))];
  const top = hit[0] || null; const word = top?.kind === 'feeling' ? top.word : null;
  const ack = top ? String(top.line || '').replace('{word}', word || '') : null;
  return { form, areas, intensity: { level: hit.length >= CFG.strongMin ? 'strong' : 'normal', signals: hit.map(c => c.cue_id), kinds, word, ack } };
}
/** v0.3: 여러 고민이 섞인 글의 주 고민 정하기(고르기 전·후 어디서나) — 일과 연애가 함께면 연애 후보를 주 고민으로, 연애와 결혼이 함께면 결혼을 주 고민으로. cands 순서를 바꿔 돌려줌 + { reason } */
export function prioritize(cands = [], text = '') {
  if (!CFG.loveFirst || cands.length < 2) return { cands, reason: null };
  const { areas } = signalsOf(text); const top = BY[cands[0].intent_id]?.topic; let i = -1, reason = null;
  if (areas.includes('연애') && areas.includes('결혼') && top !== '결혼') { i = cands.findIndex(c => BY[c.intent_id]?.topic === '결혼'); reason = 'marriage_over_love'; }
  else if (areas.includes('연애') && areas.includes('일') && WORK.has(top)) { i = cands.findIndex(c => LOVE.has(BY[c.intent_id]?.topic)); reason = 'love_over_work'; }
  if (i <= 0) return { cands, reason: null };
  return { cands: [cands[i], ...cands.filter((_, n) => n !== i)], reason, secondary: cands[0].intent_id };
}

/** v0.4: 받침 있으면 a, 없으면 b — 끝의 따옴표·괄호는 건너뜀 */
export function josa(word, a, b) { const w = String(word || '').replace(/[\s'’”"\)\]]+$/, ''); const c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return a; return (c - 0xac00) % 28 ? a : b; }
/** v0.4: 기저 생각 한 줄(대화 말투) — "{겉 질문}보다 {1순위}이 더 크게 남아 있을 수 있어요. {2순위}도 함께요." · 타로처럼 카드가 아니라 대화에서 짚어 줌. 단정하지 않음 */
export function thoughtLine(intentId) {
  const t = TH[intentId]; if (!t) return null;
  return `${t.surface}보다 ${t.first}${josa(t.first, '이', '가')} 더 크게 남아 있을 수 있어요. ${t.second}도 함께요.`;
}
/** v0.4: 기저 생각 확인 카드 — 더 가까운 마음을 고르게 함(답은 고른 갈래만 남김 · 원문 저장 없음) · v0.5: "둘 다 있어요"(기저 생각은 여러 개일 수 있음) */
export function thoughtCheck(intentId) {
  const t = TH[intentId]; if (!t) return null;
  return { intent_id: intentId, ask: '이 중에 지금 마음에 더 가까운 게 있어요?', options: [{ id: 'first', text: t.first }, { id: 'second', text: t.second }, { id: 'both', text: '둘 다 있어요' }, { id: 'neither', text: '둘 다 조금 달라요' }] };
}
/** v0.6: 세부 고민의 갈래와 그 밑의 기저 생각 여러 개 — cards = 선택지 카드 데이터(choice_cards). 갈래 = 그 장면 첫 카드의 보기(세부 고민마다 맞는 것만 · 순서대로)
 *  → [{ option_id, text, kind, thoughts: [{ option_id, text, core_thought, root }] }] · 상태·여건·선호 갈래는 thoughts가 비어 있을 수 있음(기저 생각 없이 해결책으로) */
const _BIDX = new WeakMap();
export function branchesFor(intentId, cards = {}) {
  const ids = BR[intentId] || []; if (!ids.length || !cards.options) return [];
  let byCard = _BIDX.get(cards); if (!byCard) { byCard = {}; for (const o of Object.values(cards.options)) (byCard[o.card] = byCard[o.card] || []).push(o); _BIDX.set(cards, byCard); }
  const under = o => { const out = [], st = [o], seen = new Set(); while (st.length) { const x = st.shift(); if (!x || seen.has(x.id)) continue; seen.add(x.id);
      if (x.core_thought) out.push({ option_id: x.id, text: x.text, core_thought: x.core_thought, root: (x.roots || [])[0]?.root || x.rank_roots?.[0] || null }); if (x.next_card) st.push(...(byCard[x.next_card] || [])); } return out; };
  return ids.map(id => cards.options[id]).filter(Boolean).map(o => { const th = under(o);   // v0.7: 카드에 기저 생각이 없는 갈래(상태·여건·선호)는 새로 쓴 것 하나(written · 뿌리 없음)
    return { branch_id: BID[`${intentId}|${o.id}`] || null, sub_branch_id: BROW[BID[`${intentId}|${o.id}`]]?.sub_branch_id || null, option_id: o.id, text: o.text, kind: o.kind, cue_words: BCUE[o.id]?.cue_words || null, thoughts: th.length ? th : (BTH[o.id] ? [{ option_id: o.id, text: o.text, core_thought: BTH[o.id], root: null, written: true }] : []) }; });
}
/** v0.8: 낱말 규칙으로 갈래 짐작(AI 분류를 못 쓸 때의 예비) — 걸린 갈래 가운데 순서가 앞선 것. 안 걸리거나 규칙이 없으면 세부 코드-0(갈래 모름)
 *  → { branch_id, known, hits: [branch_id …] } · 갈래가 없는 세부 고민이면 null */
export function branchGuess(intentId, text = '') {
  const ids = BR[intentId] || []; if (!ids.length) return null; const t = String(text);
  const hits = ids.filter(o => BCUE[o]?.re && BCUE[o].re.test(t)).map(o => BID[`${intentId}|${o}`]);
  return { branch_id: hits[0] || `${intentId}-0`, known: hits.length > 0, hits };
}
/** v0.7: 갈래 코드 → { intent_id, option_id, ord } · 갈래를 모를 때의 코드(세부 코드-0) */
export const branchById = id => BROW[id] ? { branch_id: id, intent_id: BROW[id].intent_id, option_id: BROW[id].option_id, ord: BROW[id].ord, sub_branch_id: BROW[id].sub_branch_id || null } : null;
export const unknownBranch = intentId => ((SB[intentId] || []).length || (BR[intentId] || []).length) ? `${intentId}-0` : null;

/* ───────── v0.9(11-23): 마스터 갈래(판정 기준 마스터 — DB sw_ob_sub_branches · sw_ob_sub_branch_roots · sw_ob_judge_rules · sw_ob_sub_criteria) ───────── */
/** 세부 고민의 갈래 전부(순위 순) → [{ branch_id, rank, is_default, sentence, kind, when_text(① 보는 때), clear_expr(② 명확한 표현), versus(③ 가르는 점), roots: [{ root_id, ord, first_concept_id }] }] */
export function subBranchesFor(intentId) { return (SB[intentId] || []).map(b => ({ ...b, roots: b.roots.map(r => ({ ...r })) })); }
export const subBranchById = id => SBID[id] ? { ...SBID[id], roots: SBID[id].roots.map(r => ({ ...r })) } : null;
/** 기본 갈래(1~3위) — 까닭이 글에 안 드러났을 때 가설로 쓰는 갈래 */
export const defaultBranches = intentId => (SB[intentId] || []).filter(b => b.is_default).slice(0, 3).map(b => b.branch_id);
export const judgeRules = () => [...(W.judge_rules || [])].sort((a, b) => (a.step - b.step) || (a.rule_id < b.rule_id ? -1 : 1));
/** 「② 명확한 표현」을 낱말 묶음으로: "가·나 + 다·라"는 (가 또는 나) 그리고 (다 또는 라) · ○○은 아무 글자 · 괄호 설명은 뺌 */
function exprOf(b) {
  if (SBRE[b.branch_id]) return SBRE[b.branch_id];
  const clean = String(b.clear_expr || '').replace(/[“”"]/g, '').replace(/\([^)]*\)/g, ' ');
  const groups = clean.split(/\s\+\s/).map(g => g.split('·').map(x => x.trim()).filter(x => x.replace(/[○\s]/g, '').length >= 2).map(x => ({ text: x, re: new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*').replace(/○+/g, '.{1,8}')) }))).filter(g => g.length);
  return (SBRE[b.branch_id] = groups);
}
/** 낱말 맞춤으로 갈래 짐작(분류 모델을 못 쓸 때의 예비 · 규칙 WT-06) — 「② 명확한 표현」이 글에 있는 갈래 가운데 맞은 낱말이 많은 것, 같으면 순위가 앞선 것.
 *  하나도 안 맞으면 「세부 코드-0」(갈래 모름 → 기본 갈래 1~3위를 가설로). → { branch_id, known, hits: [갈래 코드…], matched: { 갈래 코드: [맞은 말…] } } · 갈래가 없는 세부 고민이면 null */
export function subBranchGuess(intentId, text = '') {
  const list = SB[intentId] || []; if (!list.length) return null; const t = String(text || ''), matched = {};
  for (const b of list) { const g = exprOf(b); if (!g.length) continue; const per = g.map(x => x.filter(p => p.re.test(t)).map(p => p.text)); if (per.every(x => x.length)) matched[b.branch_id] = per.flat(); }
  const hits = Object.keys(matched).sort((a, b) => (matched[b].length - matched[a].length) || (SBID[a].rank - SBID[b].rank));
  return { branch_id: hits[0] || `${intentId}-0`, known: hits.length > 0, hits, matched };
}
/** 분류 모델에 넘길 갈래 고르기 프롬프트 — 세부 고민이 정해진 뒤에 씀. 갈래마다 ①②③을 넣음 */
export function subBranchPrompt(intentId, text) {
  const list = SB[intentId] || []; if (!list.length) return null; const i = BY[intentId] || {};
  const lines = list.map(b => `- ${b.branch_id} [${b.is_default ? '기본' : '그 밖'}] ${b.sentence}\n   ① 보는 때: ${b.when_text}\n   ② 꼭 있어야 하는 표현: ${b.clear_expr}\n   ③ 가르는 점: ${b.versus}`).join('\n');
  return `사용자의 말이 세부 고민 「${intentId} ${i.name || ''}」의 어느 갈래(그렇게 느끼는 까닭)에 해당하는지 고른다.\n기준:\n- 갈래는 까닭(원인)이다. 결과로 나타난 감정·행동만 적혀 있으면 그것으로 갈래를 정하지 않는다.\n- 「② 꼭 있어야 하는 표현」과 같은 뜻의 말이 글에 실제로 있을 때만 그 갈래로 정한다. [그 밖] 갈래는 특히 그렇다.\n- 두 갈래가 헷갈리면 ③을 보고 가른다. 까닭이 둘 이상 뚜렷하면 가장 중심인 것을 branch_id에, 나머지를 also에 적는다.\n- 까닭이 글에 안 드러났으면 branch_id는 null(기본 갈래로 안내함).\n사용자 말: “${text}”\n갈래:\n${lines}\n출력(JSON): {"branch_id":"…|null","also":["…"],"why":"한 줄"}`;
}
/** 모델 답 → { branch_id(모르면 세부 코드-0), known, also } — 이 세부 고민의 갈래가 아닌 코드는 버림 */
export function parseSubBranch(raw, intentId) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) : raw; } catch { o = null; }
  const ok = id => id && SBID[id]?.sub_id === intentId ? id : null, id = ok(o?.branch_id);
  return { branch_id: id || `${intentId}-0`, known: !!id, also: [...new Set((o?.also || []).map(ok).filter(x => x && x !== id))], why: o?.why || null, fallback: o ? null : 'parse' };
}
/** 갈래를 모를 때 기본 갈래 1~3위를 보여 주고 고르게 하는 카드(마스터: 「기본 갈래 — 까닭이 안 드러난 글에도 안내」 · 묻는 말은 초안) → branchPick으로 받음 */
export function branchCheck(intentId) {
  const d = (SB[intentId] || []).filter(b => b.is_default).slice(0, 3); if (!d.length) return null;
  return { intent_id: intentId, ask: '이 중에 지금 마음에 가까운 까닭이 있어요?', options: [...d.map(b => ({ id: b.branch_id, text: b.sentence })), { id: 'other', text: '다른 까닭이에요' }, { id: 'unknown', text: '잘 모르겠어요' }] };
}
/** v0.10(CSO 11-23 · 규칙 WT-07): 세부 고민을 알고 들어온 사람의 첫 카드 — 장면 공통 카드 문장 대신 그 세부 고민의 갈래 문장을 보기로.
 *  기본 갈래 1~3위 먼저(more = false) · 「다른 까닭이에요」를 고르면 4위부터(more = true). 보기 id = 갈래 코드 → branchPick으로 받음.
 *  option_id = 그 갈래와 문장이 같은 카드 보기(있으면 그 보기의 다음 카드로 이어 감 · 없으면 null — 바로 기저 생각·과제로) */
export function branchCard(intentId, more = false) {
  const list = SB[intentId] || []; if (!list.length) return null; const d = list.filter(b => b.is_default).slice(0, 3), rest = list.filter(b => !d.includes(b));
  const opt = b => ({ id: b.branch_id, text: b.sentence, rank: b.rank, option_id: CARD_OF[b.branch_id] || null });
  return { intent_id: intentId, ask: more ? '그럼 이 중에는 가까운 까닭이 있어요?' : '이 중에 지금 마음에 가까운 까닭이 있어요?', more, options: [...(more ? rest : d).map(opt), ...(!more && rest.length ? [{ id: 'other', text: '다른 까닭이에요' }] : []), { id: 'unknown', text: '잘 모르겠어요' }] };
}
/** 카드 답 → { branch_id, known } — 고른 갈래 코드 · 다른 까닭·모름이면 세부 코드-0(다른 까닭이면 이어서 말로 물음: ask_more) */
export function branchPick(intentId, pick) { const ok = pick && SBID[pick]?.sub_id === intentId; return { intent_id: intentId, branch_id: ok ? pick : `${intentId}-0`, known: !!ok, ask_more: pick === 'other', option_id: ok ? CARD_OF[pick] || null : null }; }
/** 갈래 → 과제 후보에 쓸 뿌리(ssol_case.branchPlan과 같은 규칙 — 대화에서 미리 보여 줄 때 씀). 아는 갈래: 뿌리 순서대로 1.2 · 1.1 · 1.0 / 모르는 갈래: 기본 갈래 1~3위의 주 뿌리 1.0 · 0.9 · 0.8 */
export function branchRootCandidates(intentId, branchId = null, ruledOut = []) {
  const list = SB[intentId] || []; if (!list.length) return null; const rej = new Set(ruledOut || []), b = branchId && !/-0$/.test(branchId) && SBID[branchId]?.sub_id === intentId ? SBID[branchId] : null;
  if (b) return { branch_id: b.branch_id, known: true, source: 'branch', used: [b.branch_id], rootless: !b.roots.length, actions: b.roots.find(r => (r.first_actions || []).length)?.first_actions || [], roots: b.roots.filter(r => !rej.has(r.root_id)).map((r, n) => ({ root_id: r.root_id, w: Math.max(1.0, +(1.2 - 0.1 * n).toFixed(2)), from: b.branch_id, first_concept_id: r.first_concept_id })) };
  const m = new Map(), used = []; list.filter(x => x.is_default).slice(0, 3).forEach((x, n) => { used.push(x.branch_id); const r = x.roots.find(y => !rej.has(y.root_id)); if (r && !m.has(r.root_id)) m.set(r.root_id, { root_id: r.root_id, w: [1.0, 0.9, 0.8][n], from: x.branch_id, first_concept_id: r.first_concept_id }); });
  return { branch_id: `${intentId}-0`, known: false, source: used.length ? 'default' : 'none', used, rootless: !m.size, roots: [...m.values()] };
}
/** v0.5: 세부 고민의 기저 생각 1·2순위에 이어진 뿌리 — { first: { root_id, mode } | null, second: … } · mode: score(점수·후보에 씀) / guess(결핍층 — 추측만) */
export function thoughtRoots(intentId) { const t = TR[intentId] || {}; return { first: t.first || null, second: t.second || null }; }
/** v0.5: 지금 고민에 걸린 기저 생각 전부 — 주 고민 1·2순위 + 부 고민 1·2순위(최대 4개). 여러 개를 함께 다루려고 씀 */
export function thoughtsFor(primaryId, secondaryId = null) {
  const out = [];
  for (const [id, role] of [[primaryId, 'primary'], [secondaryId && secondaryId !== primaryId ? secondaryId : null, 'secondary']]) {
    const t = id && TH[id]; if (!t) continue;
    for (const rank of ['first', 'second']) out.push({ intent_id: id, role, rank, text: t[rank], root_id: TR[id]?.[rank]?.root_id || null, mode: TR[id]?.[rank]?.mode || null });
  }
  return out;
}
/** v0.5: 확인 카드 답 → 뿌리 점수. first·second → 그 뿌리 +1 · both → +0.5씩(같은 뿌리면 합쳐 +1) · neither·null → 없음. 결핍층(guess)은 점수 없이 guess로만 돌려줌 */
export function thoughtPick(intentId, pick) {
  const t = TR[intentId] || {}, ranks = pick === 'both' ? ['first', 'second'] : ['first', 'second'].includes(pick) ? [pick] : [], p = pick === 'both' ? 0.5 : 1;
  const sc = new Map(), guess = [];
  for (const r of ranks) { const x = t[r]; if (!x) continue; if (x.mode === 'guess') { if (!guess.includes(x.root_id)) guess.push(x.root_id); } else sc.set(x.root_id, (sc.get(x.root_id) || 0) + p); }
  return { intent_id: intentId, pick: pick || null, ranks, score: [...sc.entries()], guess };
}
/** v0.5: 답하기 전(또는 묻지 않았을 때) 과제 후보에 쓸 뿌리 — 점수는 주지 않음. 무게: 주 1순위 1.0 · 주 2순위 0.6 · 부 1순위 0.4 · 부 2순위 0.3 · 같은 뿌리는 큰 값 · 결핍층은 뺌 */
export function thoughtCandidates(primaryId, secondaryId = null) {
  const Wt = { 'primary|first': 1.0, 'primary|second': 0.6, 'secondary|first': 0.4, 'secondary|second': 0.3 }, m = new Map();
  for (const t of thoughtsFor(primaryId, secondaryId)) { if (!t.root_id || t.mode === 'guess') continue; const w = Wt[`${t.role}|${t.rank}`]; if (w > (m.get(t.root_id)?.w || 0)) m.set(t.root_id, { root_id: t.root_id, w, from: `${t.role}_${t.rank}` }); }
  return [...m.values()].sort((a, b) => b.w - a.w);
}
/** v0.4: 주 고민과 부 고민이 다를 때 한 줄 — "겉으로는 {주 겉 질문}을 묻고 있지만, {부 겉 질문}도 함께 걸려 있는 것 같아요." */
export function secondaryLine(primaryId, secondaryId) {
  const a = TH[primaryId], b = TH[secondaryId]; if (!a || !b || primaryId === secondaryId) return null;
  return `겉으로는 ${a.surface}${josa(a.surface, '을', '를')} 묻고 있지만, ${b.surface}도 함께 걸려 있는 것 같아요.`;
}
