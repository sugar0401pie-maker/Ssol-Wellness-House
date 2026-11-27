// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.43/ssol_challenge_v0.8.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 작심삼일 챌린지 과제 v0.8(11-27 · 3일차를 주 뿌리의 「정반대」 짝 자원 뿌리에서 — 규칙 CH-07) · v0.7(11-27 · 영역 맞추기 · 3일차에 적기 과제를 안 씀 · 뿌리 없는 갈래는 세부 고민의 실천 · 1일차 대처 관찰은 대처 방식이 확인된 사람만 — 규칙 CH-07 · CH-08) · v0.6(11-27 · 갈래를 아는 사람의 3일차는 다른 갈래의 뿌리를 쓰지 않음 — 규칙 CH-07 고침) · v0.5(11-27 · 대화로 들어온 사람의 3일차를 새 과제로 · 1일차에서 이미 나간 과제 빼기 — 규칙 CH-07) · v0.4(11-26 · 1주일 단계의 익숙한 곳 판 — 규칙 CH-06 · DB v5.37) · v0.3(11-26 · 가족 고르는 순서에 반대 짝·온보딩 답 — 규칙 CH-05) · v0.2 (2026-11-24 · CSO · DB v5.35 · 규칙 CH-01~CH-04)
 *  v0.2: 활동 가족이 4단계 — L1 가벼운 판(지친 날의 2일차) · L2 2일차(사진으로 인증할 수 있는 활동 — CSO 「1주일차 내용이 2일차에」) · L3 1주일 · L4 1달
 *  다섯 칸: 1일차 글·생각(알아차림) → 2일차 행동으로 옮기기(밖에서 하는 활동) → 3일차 정리하기(2일차 돌아보기) → 1주일 → 1달(2일차 활동을 키움)
 *  - 타로를 본 사람은 타로가 낸 다섯 칸을 그대로 씀(fromTarotPlan) — challengeFor가 타로 계획이 있으면 그것을 먼저
 *  - 2일차 활동은 사람 만나기 · 운동(혼자 가능) · 꽃·자연 구경 · 나를 위한 선물 가족(sw_ob_activity_families)에서 고름:
 *    쓰는 뿌리(tc.roots → 원인 뿌리 → 갈래 뿌리 relRoots) 순서로 맞는 가족 → 온보딩에서 빼 달라고 한 활동은 뺌(personal scorer) → 지친 날은 가벼운 가족 먼저
 *  - 1주일·1달은 같은 가족의 L3·L4(새 장소·새 사람·더 큰 경험으로 키움)
 */
import * as CS from './case.mjs';

export const CHALLENGE_CFG = { useDraft: false, day1Formats: ['글', '생각'], slots: ['day1', 'day2', 'day3', 'week', 'month'],
  // v0.7(규칙 CH-08): 세부 고민 코드 앞머리 → 그 고민에 낼 수 있는 실천 영역(sw_ob_practice_area). 「육아」는 아이가 있다고 아는 사람에게만 더함
  areaByPrefix: { WK: ['공통', '나', '관계', '일'], JB: ['공통', '나', '관계', '일'], SB: ['공통', '나', '관계', '일'], PT: ['공통', '나', '관계', '일'], EX2: ['공통', '나', '관계', '일'], ED: ['공통', '나', '관계', '일'],
    CR: ['공통', '나', '관계', '연인'], LV: ['공통', '나', '관계', '연인'], RL: ['공통', '나', '관계', '연인'], EX: ['공통', '나', '관계', '연인'], MR: ['공통', '나', '관계', '연인'], ML: ['공통', '나', '관계', '연인'] },
  areaDefault: ['공통', '나', '관계'], areaChildPrefix: ['ML', 'FM'],
  day3: 'task', day3Formats: ['말', '행동', '몸'], day3SoloFormats: ['행동', '몸'], checkinTpl: '어제 해 본 「{title}」, 어땠어요?' };   // v0.5: day3 'task' = 새 과제(1일차와 다른 뿌리 · 바꿔 감 단계의 말·행동) · 'review' = 예전처럼 돌아보기만
let DATA = { families: [], review: { title_tpl: '어제 해 본 「{title}」 돌아보기', steps: [], skipped_steps: [] }, practices: {} };
/** data = { families: [{ family_id, category, roots: [], exclude_tag, easy, solo, levels: [L1 가벼운 판, L2 2일차, L3 1주일, L4 1달] }], review, practices: { pid: { title, description, status, format } } } */
export function setChallengeData(d) { DATA = { ...DATA, ...d }; }
export function challengeData() { return DATA; }

const P = id => DATA.practices[id] || null;
/** v0.7(규칙 CH-08): 이 세부 고민에 낼 수 있는 영역의 실천인지 */
export function areaAllowed(id, intentId, person = {}) {
  const a = CS.caseData().practice_area?.[id] || '공통', pre = String(intentId || '').split('-')[0];
  if (a === '육아') return !!(person.hasChild || person.known?.child === true) && CHALLENGE_CFG.areaChildPrefix.includes(pre);
  return (CHALLENGE_CFG.areaByPrefix[pre] || CHALLENGE_CFG.areaDefault).includes(a);
}
const usable = id => !!P(id) && (CHALLENGE_CFG.useDraft || P(id).status === 'approved');
const item = (id, slot, extra = {}) => id ? { slot, practice_id: id, title: P(id)?.title || null, description: P(id)?.description || null, ...extra } : null;
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** v0.3: 온보딩 취미·주말 답 → 가족별 선호 점수 { family_id: 점수 } (순위 1.0·0.7·0.5 · 주말은 ×0.5) */
export function familyPrefs(person = {}) {
  const out = {}, ob = DATA.prefs?.onboarding || {}, W = [1.0, 0.7, 0.5];
  const add = (q, keys, mult) => (keys || []).forEach((k, i) => (ob[q]?.[k] || []).forEach((f, n) => { out[f] = (out[f] || 0) + (W[i] ?? 0.5) * mult * (n ? 0.7 : 1); }));
  add('hobbies_ranked', person.prefs?.hobbies, 1); add('weekends_ranked', person.prefs?.weekends, 0.5);
  return out;
}
/** v0.3: 뿌리 → 반대 짝(자원 뿌리) → 그 자원 뿌리에 이어진 가족들 */
function pairFamilies(order) { const rr = DATA.prefs?.resource_root || {}, out = []; for (const r of order) for (const p of (DATA.pairs?.[r] || [])) for (const f of (rr[p] || [])) if (!out.some(x => x.family_id === f)) out.push({ family_id: f, via: r, pair: p }); return out; }

/** v0.4(규칙 CH-06): 온보딩 주말 답 1순위의 새로움 점수가 0보다 낮으면 익숙한 곳을 좋아하는 사람으로 봄 */
export function prefersFamiliar(person = {}) { const w = person.prefs?.weekends?.[0], n = DATA.weekend_nov?.[w]; return typeof n === 'number' && n < 0; }

/** 2일차 가족 고르기 → { family, why, score, by } | null
 *  순서(규칙 CH-05): 온보딩 취미·주말 답에 이어진 가족이 있으면 그 안에서만 고름(답이 없으면 전체) · 취미 1순위 답의 가족이 있으면 그 가족들에서만(v0.4) → 그 안에서 ① 쓰는 뿌리 · 원인 뿌리 · 갈래 뿌리 → ② 반대 짝의 자원 뿌리에 이어진 가족 → ③ 답 순위 → ④ 기본 활동 */
export function pickFamily(tc = {}, opts = {}) {
  const order = [...new Set([...(tc.roots || []), ...(tc.cause_roots || []).map(x => x.root_id), ...(tc.relRoots || [])])];
  const pers = typeof opts.personal === 'function' ? opts.personal : () => ({ exclude: false });
  const day2Of = f => opts.energy === '낮음' ? f.levels[0] : f.levels[1];   // v0.2: 2일차 = L2(인증할 수 있는 활동) · 지친 날은 L1
  const ok = f => f.levels.length === 4 && f.levels.every(usable) && !pers(day2Of(f)).exclude && !(opts.excludeFamilies || []).includes(f.family_id);
  let pool = DATA.families.filter(ok); if (!pool.length) return null;
  if (opts.energy === '낮음' && pool.some(f => f.easy)) pool = pool.filter(f => f.easy);   // 지친 날은 가벼운 것(혼자 걷기·공원·꽃·나를 위한 시간)
  if (opts.solo && pool.some(f => f.solo)) pool = pool.filter(f => f.solo);
  const sc = f => { const i = Math.min(...f.roots.map(r => order.indexOf(r)).filter(i => i >= 0)); return Number.isFinite(i) ? 100 - i : 0; };
  const pref = familyPrefs(opts.person || {}), pf = f => pref[f.family_id] || 0;
  // v0.3(CSO 11-25 「취미·주말 답은 선호하는 해결책을 정하는 데」): 온보딩 답에 이어진 가족이 있으면 그 안에서 고름 → 그 안에서 뿌리 · 반대 짝 · 답 순위 순서
  if (pool.some(f => pf(f) > 0)) pool = pool.filter(f => pf(f) > 0);
  // v0.4(CSO 11-26 「창작 활동하기에 맞는 활동이 나오게」): 취미 1순위 답에 이어진 가족이 그 안에 있으면 그 가족들에서만 고름 — 갈래 뿌리가 다른 가족과 맞아도 1순위 취미가 먼저
  const top1 = DATA.prefs?.onboarding?.hobbies_ranked?.[opts.person?.prefs?.hobbies?.[0]] || []; if (pool.some(f => top1.includes(f.family_id))) pool = pool.filter(f => top1.includes(f.family_id));
  const pairs = pairFamilies(order), pr = f => pairs.find(x => x.family_id === f.family_id) || null;
  const seed = String(opts.intentId || '') + order.join(',');
  const best = [...pool].sort((a, b) => (sc(b) - sc(a)) || ((pr(b) ? 1 : 0) - (pr(a) ? 1 : 0)) || (pf(b) - pf(a)) || (hash(seed + a.family_id) - hash(seed + b.family_id)))[0];
  const s = sc(best), p = pr(best), liked = pf(best) > 0 ? ' · 온보딩 취미·주말 답과 맞음' : '';
  if (s) return { family: best, score: s, root: order[100 - s], by: 'root', liked: pf(best) > 0, why: `${order[100 - s]}에 이어진 활동${liked}` };
  if (p) return { family: best, score: 50, root: p.via, pair: p.pair, by: 'pair', liked: pf(best) > 0, why: `${p.via}의 반대 짝 ${p.pair}에 이어진 활동${liked}` };
  if (pf(best) > 0) return { family: best, score: 10, root: null, by: 'onboarding', liked: true, why: '온보딩 취미·주말 답에 이어진 활동' };
  return { family: best, score: 0, root: null, by: 'default', liked: false, why: '맞는 뿌리가 없어 기본 활동(가벼운 것 먼저)' };
}

/** 1일차: 알아차림 단계의 글·생각 과제 하나 */
function day1Of(tc, cs, opts) {
  const c1 = { ...cs, stage: '알아차림' };
  const fmt = id => (opts.formatOf ? opts.formatOf(id)?.format : P(id)?.format) || null;
  const skip = new Set([...(opts.recent || []), ...(opts.done || [])]);   // v0.5: 대화에서 이미 나간 과제 · 이미 한 과제는 뺌
  const pool0 = (tc.candidates || []).filter(c => !skip.has(c.practice_id)), inA = pool0.filter(c => areaAllowed(c.practice_id, tc.intentId || opts.intentId, opts.person || {}));   // v0.7: 영역이 맞는 것만(하나도 없으면 그대로)
  // v0.7: 대처 방식이 대화에서 확인되지 않았으면 대처 방식별 관찰 실천(COP- 묶음)은 1일차 후보에서 뺌(남는 것이 없으면 그대로)
  const confirmed = !!cs.coping && (opts.copingConfirmed === true || ['asked', 'asked_mixed', 'confirmed'].includes(cs.coping_source));   // 카드 길·뿌리에서 짐작한 것(path · hint)은 확인된 것으로 안 봄 — 사용자가 고른 카드로 정해졌으면 copingConfirmed: true를 넘김
  const base = inA.length ? inA : pool0, noCop = confirmed ? base : base.filter(c => !/^COP-/.test(c.practice_id));   // 대처 관찰·수용 묶음(COP-OBS · COP-ACC)
  const picked = CS.pickTasks(c1, noCop.length ? noCop : base, { fallback: tc.fallback, relRoots: tc.relRoots, causeRoots: (tc.cause_roots || []).map(x => x.root_id), personal: opts.personal, formatOf: opts.formatOf });
  const hit = picked.find(t => CHALLENGE_CFG.day1Formats.includes(fmt(t.practice_id))) || picked[0];
  return hit ? hit.practice_id : null;
}

/** v0.5(규칙 CH-07): 3일차 새 과제 — 1일차와 다른 뿌리에서, 바꿔 감 단계의 말·행동 실천 하나.
 *  다른 뿌리 찾는 순서: 대화에서 확인된 둘째 뿌리부터(tc.roots) → 그 갈래의 둘째 뿌리부터(tc.branch.roots) → (갈래를 모를 때만) 같은 세부 고민의 다른 갈래 주 뿌리(순위 순) → 갈래 뿌리(relRoots)
 *  다른 사람과 하는 활동을 빼 달라고 한 사람(known.other === false · excludeTags에 other_people)은 혼자 하는 행동만. 없으면 1일차 뿌리의 받아들임 단계 과제 → 그래도 없으면 null(돌아보기로) */
function day3Of(tc, d1, d2, opts) {
  const K = CS.caseData(), RP = K.root_practices || {}, TAG = K.practice_tags || {}, person = opts.person || {};
  const pers = typeof opts.personal === 'function' ? opts.personal : () => ({ adj: 0, exclude: false });
  const fmt = id => (opts.formatOf ? opts.formatOf(id)?.format : P(id)?.format) || P(id)?.format || null, needs = id => (opts.formatOf ? opts.formatOf(id)?.needs : null) || [];
  const solo = person.known?.other === false || (person.excludeTags || []).includes('other_people');
  const skip = new Set([d1, d2, ...(opts.recent || []), ...(opts.done || [])].filter(Boolean));
  const rootsOf = id => Object.keys(RP).filter(r => RP[r].some(x => x.practice_id === id));
  const r1 = new Set(d1 ? rootsOf(d1) : []), main = (tc.roots || [])[0] || (tc.branch?.roots || [])[0] || null;
  const subs = (K.sub_branches?.[tc.intentId] || []).map(b => b.roots?.[0]?.root_id || b.roots?.[0]).filter(Boolean);
  // v0.6(CSO 11-27): 갈래를 아는 사람은 그 사람이 말한 까닭에서 벗어나지 않게 — 대화에서 확인된 둘째 뿌리 → 그 갈래의 둘째 뿌리까지만 보고, 없으면 1일차와 같은 뿌리에서 단계·형식만 다르게.
  //   갈래를 모르는 사람(기본 갈래로 가정)만 같은 세부 고민의 다른 기본 갈래 주 뿌리를 씀
  const rootless = !!tc.branch?.known && (tc.branch?.rootless || !main), known = !!tc.branch?.known;   // v0.7: 뿌리 없는 갈래도 다른 갈래의 뿌리는 안 씀
  const order = [...new Set([...(tc.roots || []).slice(1), ...(tc.branch?.roots || []).slice(1), ...(known ? [] : [...subs, ...(tc.relRoots || [])])])].filter(r => r && r !== main);
  const okP = (id, stage, formats) => !skip.has(id) && usable(id) && !/^OUT-/.test(id) && areaAllowed(id, tc.intentId || opts.intentId, person) && TAG[id]?.stage === stage && formats.includes(fmt(id)) && !(solo && needs(id).includes('other')) && !pers(id).exclude;
  // 하루에 끝낼 수 있는 것 먼저(크기 「가볍게」 · 30분 안) · 그 고민의 영역에 맞는 것 먼저
  const size = id => (opts.formatOf ? opts.formatOf(id) : null) || {}, oneDay = id => (size(id).step === '가볍게' ? 2 : 0) + ((size(id).max || 999) <= 30 ? 1 : 0);
  const area = id => (opts.cs ? (CS.areaOk(opts.cs, id, {}) ? 1 : 0) : 1);
  const best = (root, stage, formats) => (RP[root] || []).map(x => x.practice_id).filter(id => okP(id, stage, formats)).sort((a, b) => (area(b) - area(a)) || (oneDay(b) - oneDay(a)) || (pers(b).adj || 0) - (pers(a).adj || 0) || (hash(String(tc.intentId || '') + a) - hash(String(tc.intentId || '') + b)))[0] || null;
  const formats = solo ? CHALLENGE_CFG.day3SoloFormats : CHALLENGE_CFG.day3Formats;
  // 하루에 끝낼 수 있는 실천(「가볍게」)부터: 다른 뿌리의 가벼운 것 → 같은 뿌리의 가벼운 것 → 다른 뿌리의 나머지 → 같은 뿌리의 나머지 → 같은 뿌리의 받아들임 단계
  const light = id => size(id).step === '가볍게';
  const fromOther = onlyLight => { for (const pass of [r => !r1.has(r), () => true]) for (const r of order) if (pass(r)) { const id = best(r, '통합', formats); if (id && (!onlyLight || light(id))) return { id, root: r, by: 'other_root' }; } return null; };
  const fromMain = onlyLight => { if (!main) return null; const id = best(main, '통합', formats); return id && (!onlyLight || light(id)) ? { id, root: main, by: 'same_root' } : null; };
  // v0.8(CSO 11-27): 갈래를 아는 사람은 주 뿌리의 「정반대」 짝 자원 뿌리(DATA.opposite_pairs — sw_ob_root_pairs.kind = 정반대)에서도 고름 — 까닭에서 벗어나지 않으면서 1일차와 내용이 달라짐. 「채워 줌」 짝은 고민과 먼 것이 많아 안 씀
  const opp = known && main ? (DATA.opposite_pairs?.[main] || []) : [];
  const fromPair = onlyLight => { for (const r of opp) { const id = best(r, '통합', formats); if (id && (!onlyLight || light(id))) return { id, root: r, by: 'opposite_pair', of_root: main }; } return null; };
  const hit = rootless ? null : (fromOther(true) || fromPair(true) || fromMain(true) || fromOther(false) || fromPair(false) || fromMain(false)); if (hit) return hit;
  // v0.7: 뿌리 없는 갈래(갈래는 아는데 까닭이 정해지지 않음)는 그 세부 고민에 붙여 둔 실천(sw_ob_worry_practices)에서 · 적기 과제로는 채우지 않음(없으면 돌아보기)
  if (rootless) { const wp = (K.worry_practices?.[tc.intentId] || []).map(x => x.practice_id).filter(id => okP(id, '통합', formats)).sort((a, b) => (oneDay(b) - oneDay(a)) || (hash(String(tc.intentId) + a) - hash(String(tc.intentId) + b)))[0]; if (wp) return { id: wp, root: null, by: 'worry' }; }
  return null;
}

/**
 * 쏘웰라가 만드는 다섯 칸. args = { tc: taskCandidates 결과, cs: 고민 상태, personal: ssol_personal.scorer(cs, person), formatOf, energy, intentId }
 * → { source: 'ssowella', family_id, category, why, day1, day2, day3, week, month } (칸마다 { slot, practice_id, title, description } · day3은 돌아보기)
 */
export function challengePlan(args = {}) {
  const { tc = {}, cs = CS.newConcernState('u', 'free') } = args;
  const d1 = day1Of(tc, cs, args), fam = pickFamily(tc, args);
  let d2 = null, wk = null, mo = null;
  let familiar = false;
  if (fam) { const L = fam.family.levels; d2 = args.energy === '낮음' ? L[0] : L[1]; wk = L[2]; mo = L[3];
    const fv = fam.family.familiar; if (fv && usable(fv) && prefersFamiliar(args.person || {})) { wk = fv; familiar = true; } }   // v0.4: 익숙한 곳 판(1주일)   // 지친 날은 L1(가벼운 판)으로 2일차
  else {   // 가족을 못 쓰면(모두 초안·모두 빼 달라고 함) 바꿔 감 단계의 행동·몸 과제로 2일차만 채움
    const t = CS.pickTasks({ ...cs, stage: '바꿔 감' }, tc.candidates || [], { fallback: tc.fallback, relRoots: tc.relRoots, personal: args.personal, formatOf: args.formatOf });
    d2 = t[0]?.practice_id || null; }
  const day2 = item(d2, 'day2', fam ? { category: fam.family.category } : {});
  const review = day2 ? { slot: 'day3', kind: 'review', title: DATA.review.title_tpl.replace('{title}', day2.title || ''), steps: DATA.review.steps, skipped_steps: DATA.review.skipped_steps, of: d2 } : null;
  const t3 = CHALLENGE_CFG.day3 === 'task' ? day3Of(tc, d1, d2, { ...args, cs }) : null;   // v0.5: 새 과제 · 못 찾으면 돌아보기
  const day3 = t3 ? { ...item(t3.id, 'day3'), kind: 'task', root: t3.root, by: t3.by, ...(t3.of_root ? { of_root: t3.of_root } : {}), check_in: day2 ? CHALLENGE_CFG.checkinTpl.replace('{title}', day2.title || '') : null, of: d2 || null } : review;
  return { source: 'ssowella', family_id: fam?.family.family_id || null, category: fam?.family.category || null, why: fam?.why || 'no_family',
    day1: item(d1, 'day1'), day2, day3, week: item(wk, 'week', familiar ? { familiar: true } : {}), month: item(mo, 'month') };
}

/** 타로가 낸 다섯 칸을 그대로 받음. plan = { day1, day2, day3, week, month } — 칸마다 문자열 또는 { title, description?, practice_id? } */
export function fromTarotPlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const out = { source: 'tarot', family_id: null, category: null, why: 'tarot' };
  for (const s of CHALLENGE_CFG.slots) { const v = plan[s]; if (v == null) { out[s] = null; continue; }
    const o = typeof v === 'string' ? { title: v } : { ...v }; out[s] = { slot: s, practice_id: o.practice_id || null, title: o.title || null, description: o.description || null, ...(s === 'day3' ? { kind: 'review' } : {}) }; }
  return CHALLENGE_CFG.slots.some(s => out[s]?.title) ? out : null;
}

/** 타로 계획이 있으면 그대로, 없으면 쏘웰라가 만듦 */
export function challengeFor(args = {}) { return fromTarotPlan(args.tarotPlan) || challengePlan(args); }
