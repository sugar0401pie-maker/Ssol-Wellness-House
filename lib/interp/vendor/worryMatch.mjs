// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.23/ssol_worry_match_v0.4.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 첫 말 → 세부 고민(고민 문장 DB) → 장면·해결책 v0.4 (2026-11-17)
 * v0.2: 헷갈리는 말(confusers)을 정답 쪽 예시로도 씀 · 두 후보가 가까우면 되묻는 질문(clarifyFor) · 부 고민 해결책(routeFor secondary)
 * v0.4(11-17 · 타로 v3.1 · CSO 답): 기저 생각(thoughts) — thoughtLine · thoughtCheck · secondaryLine · 강도 단서 v2(10갈래 · 받아 주는 한 줄 ack · 길이) · 세부 고민에 맞는 첫 카드 보기(entry → routeFor.preferOptions)
 * v0.3(11-17 · 타로 일상고민 CSO 검토 반영): 고르기 규칙(rules)을 프롬프트에 넣음 · 같은 값 짝(pairs)은 되묻지 않고 채점에서 맞음으로 침 · 일+연애면 연애가 주 고민(prioritize) · 묻는 꼴·강도 재기(signalsOf)
 * 데이터: data/worry_v0.6.json(시험용) · 운영은 sw_ob_worry_intents · sw_ob_worry_utterances · sw_ob_worry_confusers · sw_ob_worry_questions · sw_ob_worry_pairs · sw_ob_worry_rules · sw_ob_worry_intensity_cues (ssol_db_loader worryDataFromDb)
 *
 * 흐름(제안 · 임베딩 2단계)
 *  1) 찾기: 첫 말과 예시 문장 1,748개의 비슷함 점수 → 세부 고민마다 상위 3문장 평균 → 후보 k개(rankIntents)
 *     · 운영: 임베딩 검색 점수를 넘김 rankIntents(text, { scores }) — scores = {utt_id: 비슷함} · Map · [[utt_id, 비슷함]] · [{utt_id, score}]
 *     · 점수를 안 주면 글자 2·3-gram 비교(시험용 · 미묘한 차이는 잘 못 가름)
 *  2) 고르기: 후보 k개의 정의 · 구분 단서 · 이웃과 다른 점을 분류기 프롬프트에 넣어 하나를 고름(pickPrompt → 모델 → parsePick)
 *  3) 잇기: routeFor(intent_id) → 장면 키(카드) · 장면 상태 · 해결책 실천 · 돌아보기 질문
 */
let W = { intents: [], utterances: [], confusers: [], questions: {}, pairs: [], rules: [], cues: [], thoughts: [], entry: [] };
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
    first_card: EN[intentId]?.card_id || null, preferOptions: EN[intentId]?.option_ids || [],   // v0.4: presentCard(…, { preferOptions })
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
/** v0.4: 기저 생각 확인 카드 — 둘 중 더 가까운 마음을 고르게 함(답은 고른 갈래만 남김 · 원문 저장 없음) */
export function thoughtCheck(intentId) {
  const t = TH[intentId]; if (!t) return null;
  return { intent_id: intentId, ask: '이 중에 지금 마음에 더 가까운 게 있어요?', options: [{ id: 'first', text: t.first }, { id: 'second', text: t.second }, { id: 'neither', text: '둘 다 조금 달라요' }] };
}
/** v0.4: 주 고민과 부 고민이 다를 때 한 줄 — "겉으로는 {주 겉 질문}을 묻고 있지만, {부 겉 질문}도 함께 걸려 있는 것 같아요." */
export function secondaryLine(primaryId, secondaryId) {
  const a = TH[primaryId], b = TH[secondaryId]; if (!a || !b || primaryId === secondaryId) return null;
  return `겉으로는 ${a.surface}${josa(a.surface, '을', '를')} 묻고 있지만, ${b.surface}도 함께 걸려 있는 것 같아요.`;
}
