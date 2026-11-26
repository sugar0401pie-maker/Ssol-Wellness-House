// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.39/ssol_challenge_v0.4.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 작심삼일 챌린지 과제 v0.4(11-26 · 1주일 단계의 익숙한 곳 판 — 규칙 CH-06 · DB v5.37) · v0.3(11-26 · 가족 고르는 순서에 반대 짝·온보딩 답 — 규칙 CH-05) · v0.2 (2026-11-24 · CSO · DB v5.35 · 규칙 CH-01~CH-04)
 *  v0.2: 활동 가족이 4단계 — L1 가벼운 판(지친 날의 2일차) · L2 2일차(사진으로 인증할 수 있는 활동 — CSO 「1주일차 내용이 2일차에」) · L3 1주일 · L4 1달
 *  다섯 칸: 1일차 글·생각(알아차림) → 2일차 행동으로 옮기기(밖에서 하는 활동) → 3일차 정리하기(2일차 돌아보기) → 1주일 → 1달(2일차 활동을 키움)
 *  - 타로를 본 사람은 타로가 낸 다섯 칸을 그대로 씀(fromTarotPlan) — challengeFor가 타로 계획이 있으면 그것을 먼저
 *  - 2일차 활동은 사람 만나기 · 운동(혼자 가능) · 꽃·자연 구경 · 나를 위한 선물 가족(sw_ob_activity_families)에서 고름:
 *    쓰는 뿌리(tc.roots → 원인 뿌리 → 갈래 뿌리 relRoots) 순서로 맞는 가족 → 온보딩에서 빼 달라고 한 활동은 뺌(personal scorer) → 지친 날은 가벼운 가족 먼저
 *  - 1주일·1달은 같은 가족의 L3·L4(새 장소·새 사람·더 큰 경험으로 키움)
 */
import * as CS from './case.mjs';

export const CHALLENGE_CFG = { useDraft: false, day1Formats: ['글', '생각'], slots: ['day1', 'day2', 'day3', 'week', 'month'] };
let DATA = { families: [], review: { title_tpl: '어제 해 본 「{title}」 돌아보기', steps: [], skipped_steps: [] }, practices: {} };
/** data = { families: [{ family_id, category, roots: [], exclude_tag, easy, solo, levels: [L1 가벼운 판, L2 2일차, L3 1주일, L4 1달] }], review, practices: { pid: { title, description, status, format } } } */
export function setChallengeData(d) { DATA = { ...DATA, ...d }; }
export function challengeData() { return DATA; }

const P = id => DATA.practices[id] || null;
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
  const c1 = { ...cs, stage: '알아차림' }, fmt = id => (opts.formatOf ? opts.formatOf(id)?.format : P(id)?.format) || null;
  const picked = CS.pickTasks(c1, tc.candidates || [], { fallback: tc.fallback, relRoots: tc.relRoots, causeRoots: (tc.cause_roots || []).map(x => x.root_id), personal: opts.personal, formatOf: opts.formatOf });
  const hit = picked.find(t => CHALLENGE_CFG.day1Formats.includes(fmt(t.practice_id))) || picked[0];
  return hit ? hit.practice_id : null;
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
  const day3 = day2 ? { slot: 'day3', kind: 'review', title: DATA.review.title_tpl.replace('{title}', day2.title || ''), steps: DATA.review.steps, skipped_steps: DATA.review.skipped_steps, of: d2 } : null;
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
