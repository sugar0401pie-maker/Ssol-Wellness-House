// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.39/ssol_personal_v0.12.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 개인 맞춤 v0.8 (2026-11-16 · 지나가는 일로 본 길의 해결책: applyCondition이 갈 곳(route · 여건 뿌리)을 돌려줌 · useCondition)
 * v0.7 (2026-11-15 · 연결고리 점검: 뿌리에 바로 이어지지 않은 과제의 확인 답은 절반(check_direct) · 아니라고 한 2위 뿌리(noteRuledOut) · 과제 결과 → 이론(theoryFromTasks) · 자유 대화 뿌리(freeTalkRoots))
 * v0.6 (2026-11-15 · 끝 뿌리 없는 길을 엔진이 먼저 판단(judgeCondition · resolveCondition) · 지금 해 보기는 끝 뿌리·지금 단계에 맞는 실천 먼저)
 * v0.5 (2026-11-15 · 가설 측정: 겨루는 가설 질문(rivalQuestion) · 여건 가설 질문(conditionQuestion) · 뿌리별 예측 확인 질문 · 대화 안에서 해 보기(miniExperiment) · measuredHypotheses)
 * v0.4 (2026-11-14 · 자가 점검 2회차: 실행 의도 칸에 첫 행동(firstStepOf · sw_ob_first_step_rules))
 * v0.3 (2026-11-10 · 자가 점검 재점검 7가지 반영)
 *  v0.3: ① 온보딩 맥락 답 → 사람 정보(personFromOnboarding: 필수 조건 · 하루 시간 · 하기 싫은 활동 · 가치관·취미·주말·고민 가산 · 이론 규칙)
 *        ② 즐거움·몰입·의미 갈래 고르게 ③ 확인 답 → 단계 신호(taskStageSignals) · 과제 기록 → 여력 ④ 사람들 전체 결과(setOutcomeStats · 표본 30↑일 때만)
 *        ⑤ 단계 사다리(ladder · 같은 묶음 다음 단계 / 한 단계 아래 / 다른 형식 판) ⑥ 본인 말에서 누구와·언제 뽑기(extractWords) ⑦ 다른 형식 판(alt)
 *  v0.2: 대처 방식 채우기 — 다른 고민의 대처 방식 · 심리테스트 이탈형 · 확인 질문
 * 과제를 "길"이 아니라 "그 사람"에 맞춰 고르고, 과제 결과로 가설을 검증한다.
 *
 *  ① 사람 상태 → 과제 점수(scorer): 뿌리 상태(온보딩·테스트·아스트로·대화·과제 확인)·동기 위치·몸 단계·지친 상태·맞지 않는 실천·필수 조건(rootBoost/pacingFilter 재사용)
 *     + 그날 여력(energy)과 실천 크기(practice_size: 단계·분·힘)
 *  ② 과제 결과 → 다음 고르기: 두 번 고르지 않음 → 뒤로 · 세 번 → 30일 쉼 · 못 함 → 같은 개념의 더 가볍거나 다른 형식 · 다 함 → 14일 안에 다시 안 줌 · 같은 개념 다음 단계 앞으로 · 잘 해낸 형식 앞으로
 *  ③ 가설 검증: 과제마다 확인 질문(checkFor) → 답을 근거 장부(source 'task')에 넣음 · 비슷한 두 뿌리는 확인 문장 전에 가르는 질문(beforeConfirm)
 *  ④ 촘촘한 과제: 실행 의도 칸(planFor) — 언제(장면 맥락) · 누구와 · 몇 분 · 첫 행동 · 확인 질문
 * 안전 판단은 하지 않음(lib/safety). 데이터: setPersonalData(personal_v0.21.json) — 운영은 ssol_db_loader.personalDataFromDb
 */
import * as RS from './rootState.mjs';

let P = { practice_size: {}, scene_context: {}, practice_flags: {}, root_avoid: [], opposite: {}, review: {}, titles: {}, concept: {}, coping_questions: [], codes: {}, ladder: {}, alt: {}, lexicon: [], ctx: {} };
let TH_OF = {}; let ROOTS_OF = {}, AVOID = new Set(), AREA = {}, LEX = { who: [], when: [] }, OUTCOME = { by: {}, p0: null };
export const PCFG = {
  partnerImplied: ['ML-'],   // v0.12: 이 말로 시작하는 세부 고민은 배우자가 있다고 봄
  taskTheory: { min: 2 }, freeTalk: { min: 1 },   // v0.7: 과제 결과 → 이론(같은 이론 2번) · 자유 대화에서 쓸 뿌리의 최소 점수
  judge: { min: 2, said: 2, saidWeak: 1, data: 1, scoreLo: 1, scoreHi: 2 },   // v0.6: 지나가는 일·되풀이되는 일 판단 — 본인 말 2점 · 약한 말 1점 · 쌓인 자료 1점 · 차이 2점 이상일 때만 판단
  rootBoostScale: 0.25, rootBoostCap: 1.0,          // rootBoost(확인 +2 · 가능 +1) × 0.25, 최대 +1
  skipOnce: 0.3, skipTwice: 0.6, skipRest: 3, restDays: 30,
  doneRepeatDays: 14, doneRepeat: -0.4, nextStep: 0.3, easier: 0.5, formatWeight: 0.4, formatMin: 2,
  lowEnergy: { maxEffort: 1, maxMinutes: 10 }, midEnergy: { maxEffort: 2, maxMinutes: 20 }, overCap: -0.6, lightBonus: 0.2,
  requireApproved: true,
  pref: { value1: 0.3, value23: 0.15, hobby: 0.2, weekend: 0.1, focus: 0.1, cap: 0.5 },   // ① 온보딩 가산(합쳐서 최대 +0.5 — 취향이 뿌리를 이기지 않게)
  stepOver: -0.6,                                   // ① 하루 시간에 안 맞는 단계
  pathWindow: 7, pathMin: 5, pathBonus: 0.3,        // ② 최근 과제가 한 갈래에 몰리면 다른 갈래 +0.3
  ladderUp: 0.4, ladderDown: 0.5, ladderSide: 0.4,  // ⑤ 다 함 → 다음 단계 · 못 함 → 한 단계 아래 / 같은 단계 다른 형식
  sameRootMin: 2, sameRoot: -0.5,                   // 가설 재검토
  capFail: 2, capFailDays: 14, capDone: 3,          // ③ 못 함·더 버거움 2번(14일) → 여력 한 단계 아래 · 다 함 3번 연속 → 한 단계 위
  outcome: { min: 30, prior: 20, scale: 1.5, cap: 0.3 },   // ④ 표본 30건부터 · 전체 평균 쪽으로 당김 · ±0.3
  check: { better: 0.5, betterNow: 0.25, same2: -0.5, indirect: 0.5 },              // 확인 답 → 뿌리 근거 점수
};
const STEP_N = { '가볍게': 1, '꾸준히': 2, '깊게': 3 };

/** caseData.root_practices(뿌리 → 실천)를 함께 넘기면 실천 → 뿌리 역색인을 만듦 */
export function setPersonalData(d = {}, caseData = null) {
  P = { ...P, ...d };
  AVOID = new Set(P.root_avoid || []);
  if (caseData?.practice_area) AREA = caseData.practice_area;
  if (caseData?.practice_theory) { TH_OF = {}; for (const [id, t] of Object.entries(caseData.practice_theory)) if (t?.main) TH_OF[id] = t.main; }   // v0.7
  if (d.first_step_rules) FS = d.first_step_rules.map(r => ({ ...r, re: new RegExp(r.pattern) }));
  if (d.lexicon) { LEX = { who: [], when: [] }; for (const x of d.lexicon) (LEX[x.kind] || []).push({ label: x.label, re: new RegExp(x.pattern) }); }
  if (caseData?.root_practices) { ROOTS_OF = {}; for (const [r, xs] of Object.entries(caseData.root_practices)) for (const x of xs) (ROOTS_OF[x.practice_id] = ROOTS_OF[x.practice_id] || []).push(r); }
  return P;
}
export const sizeOf = pid => P.practice_size?.[pid] || null;
let FS = [];
/** v0.4: 첫 행동 — 규칙을 위에서부터 보며 형식이 맞고 제목에 낱말이 있는 첫 규칙(없으면 형식 기본값) */
export function firstStepOf(pid) { const f = sizeOf(pid)?.format, t = P.titles?.[pid] || ''; const r = FS.find(x => (x.format === '*' || x.format === f) && x.re.test(t)); return r ? r.first_step : null; }

/** rootBoost에 넘길 실천 모양 */
function practiceObj(pid) {
  const z = sizeOf(pid) || {}, f = P.practice_flags?.[pid] || {};
  return { id: pid, roots: ROOTS_OF[pid] || [], needs: z.needs || [], exposure_step: z.exposure_step || 0,
    step: z.step === '가볍게' ? '가볍게 시작' : z.step === '깊게' ? '깊게' : z.step ? '한 걸음 더' : null,
    beyond_self: !!f.beyond_self, motive_fit: f.motive_fit || [], review_status: P.review?.[pid] || null };
}

/** 그날 여력: 본인이 말한 것 > 몸 단계·지친 뿌리 > 보통 */
export function capacityOf(person = {}) {
  const st = person.rootStates || {};
  let e = person.energy || (RS.bodyHold(st, person) || RS.TIRED_ROOTS.some(r => ['likely', 'confirmed'].includes(st[r]?.status)) ? '낮음' : '보통'), from = person.energy ? 'said' : 'state';
  if (!person.energy) {   // v0.3 ③: 과제 기록으로 한 단계 조정(본인이 말한 여력이 있으면 그게 앞섬)
    const LV = ['낮음', '보통', '충분'], now = Date.now(), done = (person.tasks || []).filter(t => t.practice_id && t.result);
    const hard = done.filter(t => (t.result === '못 함' || t.check_answer === '더 버거웠어요') && (!t.at || (now - Date.parse(t.at)) / 864e5 <= PCFG.capFailDays)).length;
    const last = done.slice(-PCFG.capDone);
    if (hard >= PCFG.capFail) { e = LV[Math.max(0, LV.indexOf(e) - 1)]; from = 'history_down'; }
    else if (last.length === PCFG.capDone && last.every(t => t.result === '다 함' && t.check_answer !== '더 버거웠어요')) { e = LV[Math.min(2, LV.indexOf(e) + 1)]; from = 'history_up'; }
  }
  const c = { energy: e, from, ...(e === '낮음' ? PCFG.lowEnergy : e === '충분' ? { maxEffort: 3, maxMinutes: 60 } : PCFG.midEnergy) };
  if (person.maxMinutes) c.maxMinutes = Math.min(c.maxMinutes, person.maxMinutes);   // ① 하루에 낼 수 있는 시간
  return c;
}

/** 사람에 맞춘 필수 조건(모름이면 빼지 않는 조건은 기본 있음으로 봄) */
function knownFor(cs, person) {
  const k = { other: true, ...(person.known || {}) };
  if (/^couple_|^marry_|wedding_prep|in_laws|spouse_roles/.test(cs?.concern_id || '') && k.partner === undefined) k.partner = true;
  if (cs?.domain5 === '진로' && k.work === undefined) k.work = !['path_direction', 'job_seek_long', 'interview_ahead', 'exam_before', 'exam_long', 'exam_result_wait', 'job_result_wait'].includes(cs.concern_id);
  if (k.child === undefined) k.child = !!person.hasChild;
  return k;
}

/** ② 과제 기록 요약(sw_user_tasks 행들) */
export function historyOf(tasks = [], now = Date.now()) {
  const day = 864e5, H = { skip: {}, rest: new Set(), done: {}, failed: new Set(), harder: new Set(), fmt: {}, concepts: { failed: new Set(), done: new Set() }, fam: { done: {}, failed: {} }, failedFmt: {}, paths: [], sameRoot: {}, betterRoot: {} };
  for (const t of tasks) {
    const age = t.at ? (now - Date.parse(t.at)) / day : 0;
    for (const id of (t.offered || []).map(x => x.practice_id || x)) if (t.practice_id && id !== t.practice_id) H.skip[id] = (H.skip[id] || 0) + 1;
    if (!t.practice_id || !t.result) continue;
    if (t.check_root && t.check_answer === '그대로예요') H.sameRoot[t.check_root] = (H.sameRoot[t.check_root] || 0) + 1;
    if (t.check_root && t.check_answer === '조금 나아졌어요') H.betterRoot[t.check_root] = (H.betterRoot[t.check_root] || 0) + 1;
    const z = sizeOf(t.practice_id) || {}, c = P.concept?.[t.practice_id], L = P.ladder?.[t.practice_id];
    const pth = t.path || P.practice_flags?.[t.practice_id]?.path; if (pth) H.paths.push(pth);
    const f = H.fmt[z.format] || (H.fmt[z.format] = { n: 0, ok: 0 }); f.n++; f.ok += t.result === '다 함' ? 1 : t.result === '조금' ? 0.5 : 0;
    const hard = (t.result === '못 함' || t.check_answer === '더 버거웠어요') && age <= PCFG.restDays;
    if (t.result === '못 함' && age <= PCFG.restDays) { H.failed.add(t.practice_id); if (c) H.concepts.failed.add(c); }
    if (t.result === '다 함') { if (age <= PCFG.doneRepeatDays) H.done[t.practice_id] = true; if (c) H.concepts.done.add(c); }
    if (t.check_answer === '더 버거웠어요') H.harder.add(t.practice_id);
    if (hard) { H.failedFmt[P.alt?.[t.practice_id] || t.practice_id] = z.format; if (L) { H.fam.failed[L.family] = Math.min(H.fam.failed[L.family] ?? 9, L.level); H.failedFmt[L.family] = z.format; } }
    else if (t.result === '다 함' && L) H.fam.done[L.family] = Math.max(H.fam.done[L.family] ?? 0, L.level);
  }
  for (const [id, n] of Object.entries(H.skip)) if (n >= PCFG.skipRest) H.rest.add(id);
  const rec = H.paths.slice(-PCFG.pathWindow); H.pathStuck = rec.length >= PCFG.pathMin && new Set(rec).size === 1 ? rec[0] : null;   // ② 최근 과제가 한 갈래뿐
  return H;
}

/** ①+② 한 실천의 사람 점수 → { adj, exclude, reasons } */
export function personalScore(pid, cs, person = {}, H = null, cap = null) {
  H = H || historyOf(person.tasks || []); cap = cap || capacityOf(person);
  const reasons = []; let adj = 0;
  const z0 = sizeOf(pid) || {}, cd = P.codes?.[pid];
  // ① 온보딩 맥락: 하기 싫은 활동 · 연애 실천 막음 · 하루 시간보다 긴 실천은 뺌
  if (person.excludeTags?.length && cd?.exclude?.some(x => person.excludeTags.includes(x))) return { adj: 0, exclude: true, reasons: [`OB-Q9 추천받고 싶지 않은 활동(${cd.exclude.filter(x => person.excludeTags.includes(x)).join('·')})`] };
  if (person.blockRomance && AREA[pid] === '연인') return { adj: 0, exclude: true, reasons: ['OB 연애할 마음 없음 — 연인 실천 안 냄'] };
  if (person.maxMinutes && (z0.min || 0) > person.maxMinutes) return { adj: 0, exclude: true, reasons: [`OB 하루 ${person.maxMinutes}분 — 더 긴 실천`] };
  const rb = RS.rootBoost(practiceObj(pid), person.rootStates || {}, { enabled: true, requireApproved: PCFG.requireApproved, known: knownFor(cs, person), motivePosition: person.motivePosition,
    beyondSignal: person.beyondSignal, avoid: AVOID, opposite: P.opposite, bodyHold: person.bodyHold });
  if (rb.exclude) return { adj: 0, exclude: true, reasons: rb.reasons };
  if (rb.boost) { adj += Math.min(PCFG.rootBoostCap, rb.boost * PCFG.rootBoostScale); reasons.push(...rb.reasons.filter(r => r !== 'disabled')); }
  if (H.rest.has(pid)) return { adj: 0, exclude: true, reasons: ['P-02 세 번 고르지 않음 — 30일 쉼'] };
  if (H.failed.has(pid) || H.harder.has(pid)) return { adj: 0, exclude: true, reasons: ['P-03 지난번 못 함·더 버거움 — 같은 실천은 잠시 쉼'] };
  if (H.skip[pid]) { adj -= H.skip[pid] >= 2 ? PCFG.skipTwice : PCFG.skipOnce; reasons.push(`P-02 고르지 않음 ${H.skip[pid]}번`); }
  if (H.done[pid]) { adj += PCFG.doneRepeat; reasons.push('P-04 최근 다 함 — 다른 과제 먼저'); }
  const z = sizeOf(pid) || {}, c = P.concept?.[pid], L = P.ladder?.[pid], base = P.alt?.[pid] || pid;
  // ⑤ 단계 사다리: 같은 묶음(가족 · 개념)에서 다 함 → 다음 단계 · 못 함 → 한 단계 아래 / 같은 단계 다른 형식 · 못 했던 실천의 다른 형식 판
  if (L && H.fam.failed[L.family] !== undefined && L.level < H.fam.failed[L.family]) { adj += PCFG.ladderDown; reasons.push(`P-07 못 했던 묶음(${L.family}) — 한 단계 아래`); }
  else if ((L && H.fam.failed[L.family] === L.level && H.failedFmt[L.family] && z.format !== H.failedFmt[L.family]) || (H.failedFmt[base] && base !== pid && z.format !== H.failedFmt[base]) || [...H.failed].some(f => P.alt?.[f] === base && f !== pid)) { adj += PCFG.ladderSide; reasons.push('P-07 못 했던 실천 — 같은 단계 다른 형식'); }
  else if (c && !L && H.concepts.failed.has(c) && (z.effort || 2) <= 1) { adj += PCFG.easier; reasons.push('P-03 못 했던 개념 — 더 가벼운 판'); }
  if (L && H.fam.done[L.family] !== undefined && L.level === H.fam.done[L.family] + 1) { adj += PCFG.ladderUp; reasons.push(`P-07 해낸 묶음(${L.family}) — 다음 단계`); }
  else if (c && !L && H.concepts.done.has(c) && (STEP_N[z.step] || 1) >= 2) { adj += PCFG.nextStep; reasons.push('P-04 해낸 개념 — 다음 단계'); }
  // ① 온보딩 가산: 가치관 1순위 +0.3 · 2·3순위 +0.15 · 취미 +0.2 · 주말·고민 +0.1 (합쳐서 최대 +0.5)
  if (cd && person.prefs) { const pf = person.prefs, hit = (a, b) => (a || []).some(x => (b || []).includes(x)); let b = 0; const why = [];
    if (pf.values?.length) { if (cd.values.includes(pf.values[0])) { b += PCFG.pref.value1; why.push('가치관 1순위'); } else if (hit(pf.values.slice(1, 3), cd.values)) { b += PCFG.pref.value23; why.push('가치관'); } }
    if (hit(pf.hobbies, cd.hobbies)) { b += PCFG.pref.hobby; why.push('취미'); }
    if (hit(pf.weekends, cd.weekends)) { b += PCFG.pref.weekend; why.push('주말'); }
    if (hit(pf.focus, cd.focus)) { b += PCFG.pref.focus; why.push('고민'); }
    if (b) { adj += Math.min(PCFG.pref.cap, b); reasons.push(`OB 온보딩 답과 맞음(${why.join('·')})`); } }
  if (person.steps?.length && z.step && !person.steps.includes(z.step)) { adj += PCFG.stepOver; reasons.push('OB 하루 시간에 비해 큰 단계'); }
  // 가설 재검토: 같은 뿌리를 겨냥한 과제가 "그대로예요" 2번 이상(나아짐보다 많음)이면, 그 뿌리에만 이어진 실천은 뒤로 — 다른 뿌리 실천이 올라옴
  { const rs = ROOTS_OF[pid] || [], weak = r => (H.sameRoot[r] || 0) >= PCFG.sameRootMin && (H.sameRoot[r] || 0) > (H.betterRoot[r] || 0);
    if (rs.length && rs.some(weak) && rs.filter(r => (cs.roots || rs).includes(r)).every(weak)) { adj += PCFG.sameRoot; reasons.push(`P-09 ${rs.filter(weak).join('·')} 과제가 그대로 ${PCFG.sameRootMin}번 — 다른 가설 먼저`); } }
  // ② 갈래 고르게(RC-21)
  const pth = P.practice_flags?.[pid]?.path; if (H.pathStuck && pth && pth !== H.pathStuck) { adj += PCFG.pathBonus; reasons.push(`RC-21 최근 과제가 ${H.pathStuck}뿐 — 다른 갈래`); }
  // ④ 사람들 전체 결과(표본이 찬 실천만)
  const oc = outcomeAdj(pid); if (oc) { adj += oc; reasons.push(`P-08 나아짐 비율 반영 ${oc > 0 ? '+' : ''}${oc}`); }
  const f = H.fmt[z.format]; if (f && f.n >= PCFG.formatMin) { const d = PCFG.formatWeight * (f.ok / f.n - 0.5); if (d) { adj += d; reasons.push(`P-05 ${z.format} 형식 해낸 비율 ${Math.round(f.ok / f.n * 100)}%`); } }
  if ((z.effort || 1) > cap.maxEffort || (z.max || 0) > cap.maxMinutes) { adj += PCFG.overCap; reasons.push(`P-06 여력 ${cap.energy} — 큰 과제는 뒤로`); }
  else if (cap.energy === '낮음' && z.step === '가볍게') { adj += PCFG.lightBonus; reasons.push('P-06 여력 낮음 — 가벼운 과제 먼저'); }
  return { adj: +adj.toFixed(3), exclude: false, reasons };
}

/** ④ 사람들 전체 결과: rows = sw_stats_practice_weekly를 실천별로 더한 것 [{practice_id, checked, improved}] — 표본 min건 이상만, 전체 평균 쪽으로 당겨 ±cap */
export function setOutcomeStats(rows = []) {
  const by = {}; let n = 0, k = 0;
  for (const r of rows) { const o = by[r.practice_id] || (by[r.practice_id] = { n: 0, k: 0 }); o.n += Number(r.checked) || 0; o.k += Number(r.improved) || 0; n += Number(r.checked) || 0; k += Number(r.improved) || 0; }
  OUTCOME = { by, p0: n ? k / n : null }; return OUTCOME;
}
function outcomeAdj(pid) {
  const o = OUTCOME.by[pid], C = PCFG.outcome; if (!o || OUTCOME.p0 === null || o.n < C.min) return 0;
  const rate = (o.k + C.prior * OUTCOME.p0) / (o.n + C.prior);
  return +Math.max(-C.cap, Math.min(C.cap, (rate - OUTCOME.p0) * C.scale)).toFixed(3);
}

/** ssol_case.pickTasks에 넘기는 사람 점수 함수: opts.personal = scorer(cs, person) */
/** v0.12(CSO 11-26 · 규칙 PARTNER-ML-1126): 배우자와의 고민(세부 고민 코드가 PCFG.partnerImplied로 시작 — ML-)으로 들어온 사람은 배우자가 있다고 봄.
 *  온보딩으로는 결혼 여부를 알기 어려워서(유추만 가능). 「커플 활동은 추천받고 싶지 않다」고 한 사람(known.partner === false)은 그대로 둠 */
export function personForIntent(person = {}, intentId = null) {
  if (!intentId || !(PCFG.partnerImplied || []).some(p => String(intentId).startsWith(p)) || person.known?.partner === false || person.known?.partner === true) return person;
  return { ...person, known: { ...(person.known || {}), partner: true }, partnerImpliedBy: intentId };
}
/** scorer(cs, person, intentId) — intentId(세부 고민 코드)를 넘기면 personForIntent를 거침 */
export function scorer(cs, person = {}, intentId = null) {
  person = personForIntent(person, intentId);
  const H = historyOf(person.tasks || []), cap = capacityOf(person), memo = {};
  return pid => (memo[pid] = memo[pid] || personalScore(pid, cs, person, H, cap));
}

/** ③ 과제 뒤 확인 질문(가설 예측) — 단계마다 무엇이 달라져야 하는지 */
const CHECK = {
  '관찰': '해 보니, 그 마음이 올라오는 순간을 알아차리기가 조금 쉬워졌나요?',
  '수용': '해 보니, 그 마음이 조금 덜 버겁게 느껴졌나요?',
  '통합': '해 보니, 그 상황에서 내가 하는 게 조금 달라졌나요?',
};
export const CHECK_OPTIONS = ['조금 나아졌어요', '그대로예요', '더 버거웠어요', '잘 모르겠어요'];
/** v0.5: 뿌리별 예측이 있으면 그 문장(이 뿌리가 맞다면 무엇이 달라지는지) · 없으면 단계별 문장 */
export function checkFor(task) { const q = task.root && task.root_direct !== false && P.root_predictions?.[task.root];   // v0.7: 그 뿌리에 이어진 실천일 때만 뿌리 질문(장면 실천 등은 단계 질문)
  return { question: q || CHECK[task.stage] || CHECK['관찰'], options: CHECK_OPTIONS, root: task.root || null, kind: q ? 'root_prediction' : 'stage' }; }

/** 확인 답 → 근거 장부(source 'task'). tasks = 이 사용자의 과제 행(같은 뿌리 '그대로'가 두 번이면 가설을 낮추고 가르는 질문을 권함) */
export function applyTaskCheck(states, userId, row, answer, sink, tasks = [], at = new Date().toISOString()) {
  const r = row.check_root; const out = { row: { ...row, check_answer: answer, check_at: at }, evidence: null, discriminate: false };
  if (!r) return out;
  const st = states[r] || (states[r] = RS.newRootState(userId, r));
  const sameBefore = tasks.filter(t => t.check_root === r && t.check_answer === '그대로예요' && t.id !== row.id).length;
  let pts = 0;
  if (answer === '조금 나아졌어요') pts = row.in_session ? PCFG.check.betterNow : PCFG.check.better;   // 대화 안에서 바로 한 확인은 절반만
  if (pts > 0 && row.check_direct === false) pts *= PCFG.check.indirect;   // v0.7: 그 뿌리를 겨냥한 실천이 아니면(장면 실천 · 채운 과제) 절반만
  else if (answer === '그대로예요' && sameBefore >= 1) { pts = PCFG.check.same2; out.discriminate = true; }
  if (pts) { RS.addEvidence(st, 'task', pts, sink, { event_id: `task:${row.id || row.practice_id}:${r}`, chat_id: row.result_chat_id, at, meta: { practice_id: row.practice_id, answer } }); out.evidence = { root: r, points: pts }; }
  return out;
}

/** ③ 확인 문장 전에: 점수가 비슷한 두 뿌리를 가르는 질문(없으면 null). asked = 이미 물은 group_id */
export function beforeConfirm(states, asked = new Set(), gap = 1.0) {
  const q = RS.pickDiscriminator(states, asked instanceof Set ? asked : new Set(asked), gap);
  return q ? { ...q, options: [...q.options.map(o => ({ text: o.answer_hint, root: o.root })), { text: '둘 다 비슷해요', root: 'both' }, { text: '잘 모르겠어요', root: null }] } : null;
}
/** 가르는 질문 답 → 고른 뿌리 +1 · 둘 다 +0.5씩(source chat) */
export function applyDiscriminator(states, userId, q, pick, sink, chatId = null, at = new Date().toISOString()) {
  const give = pick === 'both' ? q.roots.map(r => [r, 0.5]) : pick ? [[pick, 1]] : [];
  for (const [r, p] of give) RS.addEvidence(states[r] || (states[r] = RS.newRootState(userId, r)), 'chat', p, sink, { event_id: `disc:${q.group}:${chatId || at}:${r}`, chat_id: chatId, at, meta: { discriminator: q.group } });
  return { asked: q.group, given: give };
}

/** ④ 실행 의도 칸: 언제 · 누구와 · 어디서 · 몇 분 · 첫 행동 · 확인 질문. words = 본인이 말한 상대·때(있으면 그걸 씀) */
export function planFor(task, cs, words = {}) {
  const ctx = P.scene_context?.[cs.concern_id] || {}, z = sizeOf(task.practice_id) || {};
  const cue = words.when || ctx.cue || null, who = words.who || ctx.who || null;
  const title = P.titles?.[task.practice_id] || task.practice_id;
  const minutes = z.max ? (z.min && z.min !== z.max ? `${z.min}~${z.max}분` : `${z.max}분`) : null;
  return { cue, who, where: words.where || ctx.where || null, minutes, step: z.step || null, format: z.format || null, first_step: firstStepOf(task.practice_id),
    when_options: [cue ? (words.when ? cue : `다음에 ${cue}`) : null, '오늘 안에', '이번 주 중 하루'].filter(Boolean),
    line: `${cue ? `${words.when ? '' : '다음에 '}${cue} — ` : ''}“${title}”${minutes ? ` · ${minutes}` : ''}`, from_words: { who: !!words.who, when: !!words.when },
    check: checkFor(task) };
}
/** pickTasks 결과에 계획과 확인 뿌리를 붙임. roots = 이번 길의 끝 뿌리(taskCandidates.roots) */
export function withPlans(tasks, cs, roots = [], words = {}) {
  return tasks.map(t => { const direct = (ROOTS_OF[t.practice_id] || []).find(r => roots.includes(r)) || null, own = direct || roots[0] || null; const x = { ...t, root: own, root_direct: !!direct }; return { ...x, plan: planFor(x, cs, words) }; });
}
/** sw_user_tasks 행에 넣을 값(taskOffered 뒤 taskChosen 때) */
export const taskPlanFields = t => ({ plan: t.plan || null, check_root: t.root || null, check_direct: t.root ? t.root_direct !== false : null, format: t.plan?.format || null, path: P.practice_flags?.[t.practice_id]?.path || null, task_stage: t.stage || null });

/* ───────── v0.2(11-10): 대처 방식 채우기 — 카드 길에서 안 보이면(약 46%) 순서대로 ───────── */
const COPINGS = ['회피', '굴복', '과잉보상'];
/** ① 같은 사람의 다른 고민(sw_user_concern_state)에서 같은 대처 방식이 2번 이상 → ② 심리테스트 주 대처방식이 이탈(disengage) → 회피 */
export function copingHint(person = {}, exceptConcern = null) {
  const n = {}; for (const r of person.concerns || []) if (r.concern_id !== exceptConcern && COPINGS.includes(r.coping) && (r.stage_signals?._meta?.coping_source || r.coping_source) !== 'hint') n[r.coping] = (n[r.coping] || 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return { coping: best[0], source: 'other_concerns', count: best[1] };
  if (person.testCoping === 'disengage') return { coping: '회피', source: 'test_disengage' };
  return null;
}
/** 고민 상태에 대처 방식이 없으면 짐작으로 채움(coping_source = 'hint' — 확인 질문 답이나 카드 길이 오면 그걸로 바뀜) */
export function fillCoping(cs, person = {}) {
  if (cs.coping) return cs;
  const h = copingHint(person, cs.concern_id); if (h) { cs.coping = h.coping; cs.coping_source = 'hint'; cs.coping_hint = h.source; }
  return cs;
}
/** 그래도 모르면 한 번 묻는 질문(장면 영역마다) — 이미 물었으면 null */
export function copingQuestion(cs, asked = false) {
  if (asked || (cs.coping && cs.coping_source !== 'hint')) return null;
  const q = (P.coping_questions || []).find(x => x.domain5 === cs.domain5) || (P.coping_questions || [])[0];
  return q ? { q_id: q.q_id, ask: q.ask, options: q.options } : null;
}
/** 답 → 고민 상태의 대처 방식(본인 답이 짐작보다 앞섬) · '그때그때 달라요'(null)면 비워 둠 */
export function applyCopingAnswer(cs, coping) {
  if (COPINGS.includes(coping)) { cs.coping = coping; cs.coping_source = 'asked'; } else if (cs.coping_source === 'hint') { cs.coping = null; cs.coping_source = 'asked_mixed'; }
  return cs;
}

/* ───────── v0.3(11-10): ① 온보딩 맥락 답 → 사람 정보 ───────── */
const STEP_OF_TIER = { '가볍게 시작': '가볍게', '꾸준히 이어가기': '꾸준히', '장기 습관·정체성으로': '깊게' };
/**
 * answers = 온보딩 답 { 질문: { value } } (computeOnboardingProfile에 넘기는 것과 같음) · base = 서버가 따로 아는 것(rootStates · tasks · energy …)
 * 돌려줌: person — known(파트너·아이·재직·다른 사람) · maxMinutes · steps · excludeTags · blockRomance · prefs(가치관·취미·주말·고민) · theoryPrefer · theoryExclude
 * 규칙은 sw_ob_ctx_options(practice_filter · practice_adjust · theory_rules)를 그대로 읽음. 대화에서 바뀐 값(sw_ob_ctx_updates)이 있으면 answers에 최신 값을 넣어 주세요.
 */
export function personFromOnboarding(answers = {}, base = {}) {
  const val = q => { const v = answers[q]?.value ?? answers[q]; return v == null ? [] : Array.isArray(v) ? v : [v]; };
  const known = { ...(base.known || {}) }, ex = new Set(base.excludeTags || []), prefer = new Set(), exclude = new Set(); let maxMinutes = base.maxMinutes || null, steps = null, blockRomance = !!base.blockRomance;
  const allow = (k, v) => { if (v === 'block') known[k] = false; else if (v === 'allow' && known[k] !== false) known[k] = true; };
  for (const [q, opts] of Object.entries(P.ctx || {})) for (const key of val(q)) { const o = opts[key]; if (!o) continue; const f = o.filter || {}, a = o.adjust || {}, t = o.theory || {};
    if (f.partner_need) allow('partner', f.partner_need);
    if (f.child_care_need) allow('child', f.child_care_need);
    if (f.work_context_need) allow('work', typeof f.work_context_need === 'string' ? f.work_context_need : f.work_context_need.working_any);
    if (f.other_people_need) allow('other', f.other_people_need);
    if (f.romance_practice === 'block') blockRomance = true;
    if (f.exclude_tag) ex.add(f.exclude_tag);
    if (f.crowded === 'exclude') ex.add('crowded_places');
    if (a.max_minutes) maxMinutes = Math.min(maxMinutes || 999, a.max_minutes);
    if (a.tier) steps = a.tier.map(x => STEP_OF_TIER[x]).filter(Boolean);
    for (const x of t.prefer || []) prefer.add(x); for (const x of t.exclude || []) exclude.add(x); }
  // 하기 싫은 활동(Q9)은 다른 답보다 앞섬: 연인·아이·일·다른 사람
  for (const key of val('excluded_activities')) { if (key === 'couple') known.partner = false; if (key === 'child') known.child = false; if (key === 'work') known.work = false; if (key === 'other_people') known.other = false; ex.add(key); }
  for (const x of exclude) prefer.delete(x);
  return { ...base, known, hasChild: known.child === true || !!base.hasChild, maxMinutes, steps, excludeTags: [...ex], blockRomance,
    prefs: { values: val('values_ranked').slice(0, 3), hobbies: val('hobbies_ranked').slice(0, 3), weekends: val('weekends_ranked').slice(0, 3), focus: val('focus_domains') },
    theoryPrefer: [...prefer], theoryExclude: [...exclude], activity: val('primary_activity')[0] || null };
}

/* ───────── v0.3(11-10): ③ 과제 결과·확인 답 → 단계 신호(ssol_case.addStageSignals에 넘김) ───────── */
/** 관찰·수용 과제에서 나아짐 → 받아들임 쪽(AC-TASK left) · 통합 과제를 다 하고 나아짐 → 바꿔 감 쪽(AC-TASK-R right + FW-TASK). 한 번으로 단계가 바뀌지 않음(신호 2번 · 체념이면 안 올림 — stageOf 규칙 그대로) */
export function taskStageSignals(row = {}, answer = row.check_answer) {
  if (answer !== '조금 나아졌어요') return [];
  const st = row.task_stage || sizeStage(row.practice_id);
  if (st === '통합') return row.result === '다 함' ? [{ id: 'AC-TASK-R', side: 'right' }, { id: 'FW-TASK' }] : [];
  return row.result === '못 함' ? [] : [{ id: 'AC-TASK', side: 'left' }];
}
let STAGE_OF = null; export function setPracticeStages(practiceTags = {}) { STAGE_OF = Object.fromEntries(Object.entries(practiceTags).map(([k, v]) => [k, v.stage])); }
const sizeStage = pid => STAGE_OF?.[pid] || null;

/* ───────── v0.3(11-10): ⑥ 본인 말에서 누구와·언제 뽑기(사전 sw_ob_plan_lexicon) — 짧은 낱말만 돌려줌(원문은 저장하지 않음) ───────── */
export function extractWords(text = '') {
  const pick = L => { let best = null; for (const x of L) { const m = x.re.exec(text); if (m && (!best || m.index < best.i || (m.index === best.i && m[0].length > best.n))) best = { i: m.index, n: m[0].length, label: x.label }; } return best?.label || null; };
  return { who: pick(LEX.who), when: pick(LEX.when) };
}
/** 여러 마디(오래된 것 → 최신)에서 가장 최근에 나온 상대·때 — withPlans의 words로 넘김 */
export function wordsFrom(texts = [], prev = {}) {
  const w = { ...prev }; for (const t of texts) { const x = extractWords(t); if (x.who) w.who = x.who; if (x.when) w.when = x.when; } return w;
}

/** ⑤ 사다리 후보: 과제 기록에서 다 한 묶음의 다음 단계 · 못 한 묶음의 한 단계 아래 · 못 한 실천의 다른 형식 판을 과제 후보에 더함(taskCandidates 결과에 · ladder 표시 up·down·side) — pickTasks가 둘 중 한 자리를 이어 가는 과제로 채움(CASE_CFG.ladderSlot) */
export function addLadderCandidates(tc, person = {}) {
  const H = historyOf(person.tasks || []), at = new Map(tc.candidates.map(c => [c.practice_id, c]));
  const mark = (pid, dir) => { const c = at.get(pid); if (c) c.ladder = c.ladder || dir; else { const n = { practice_id: pid, score: 0.8, from: 'ladder', ladder: dir }; tc.candidates.push(n); at.set(pid, n); } };
  for (const [pid, L] of Object.entries(P.ladder || {})) {
    if (H.fam.done[L.family] !== undefined && L.level === H.fam.done[L.family] + 1) mark(pid, 'up');
    else if (H.fam.failed[L.family] !== undefined && L.level < H.fam.failed[L.family]) mark(pid, 'down'); }
  for (const [alt, base] of Object.entries(P.alt || {})) if (H.failed.has(base) || H.harder.has(base)) mark(alt, 'side');
  return tc;
}

/* ───────── v0.5(11-15): 가설 측정률 ───────── */
const RIVAL_LAYERS = ['규칙·전략', '사고·감정', '상태·여건', '행동', '결핍'];   // 자원·기질은 겨루는 가설로 세우지 않음 · v0.11: 결핍도 세움(CSO 11-23 — 결핍 추측만 원칙을 없앰)
/**
 * ① 카드 끝에서 겨루는 가설: 끝 뿌리가 하나일 때, 지나온 보기의 갈래 뿌리 순위에서 그다음 뿌리(2위 가설)를 찾아 확인 문장 전에 한 번 견줌
 *  - 두 뿌리를 가르는 질문 묶음이 있으면 그 질문(보기 2 + 둘 다 + 모름) → 답은 applyDiscriminator
 *  - 없으면 2위 뿌리의 예·아니요 확인 질문(sw_ob_root_predictions.probe_question)으로 → 답은 applyRival
 * asked = 이미 물은 묻기 id(sw_user_disc_asked.group_id) · rejected = 아니라고 한 뿌리
 */
export function rivalQuestion(pathOptionIds = [], options = {}, tc = {}, asked = new Set(), rejected = []) {
  if (tc.fallback || (tc.roots || []).length !== 1) return null;
  const r1 = tc.roots[0], rej = new Set([...rejected, ...(tc.ruledOut || [])]); let rv = null;
  for (const id of [...pathOptionIds].reverse()) { rv = (options[id]?.rank_roots || []).find(r => r !== r1 && !rej.has(r) && RIVAL_LAYERS.includes(P.root_layer?.[r])); if (rv) break; }
  if (!rv) return null;
  const A = asked instanceof Set ? asked : new Set(asked);
  const g = RS.discriminatorFor(r1, rv, A);
  if (g) return { type: 'discriminator', group: g.group, roots: [r1, rv], ask: g.ask, options: [...g.options.map(o => ({ text: o.answer_hint, root: o.root })), { text: '둘 다 비슷해요', root: 'both' }, { text: '잘 모르겠어요', root: null }] };
  const id = `RV:${rv}`; if (A.has(id) || !P.root_check?.[rv]) return null;
  return { type: 'probe', group: id, roots: [r1, rv], ask: P.root_check[rv], options: [{ text: '네, 그런 편이에요', answer: 'yes' }, { text: '아니요, 그건 아니에요', answer: 'no' }, { text: '잘 모르겠어요', answer: null }] };
}
/** probe 답: 예 → 2위 뿌리 +0.5(후보로 남김 · 다음 과제 후보에 더할 뿌리로 돌려줌) · 아니요 → 점수 없이 "견줘 봄"만 기록 */
export function applyRival(states, userId, q, answer, sink, chatId = null, at = new Date().toISOString()) {
  if (q.type === 'discriminator') return applyDiscriminator(states, userId, q, answer, sink, chatId, at);
  const rv = q.roots[1], kind = q.type === 'cause' ? 'cause' : 'rival';
  if (answer === 'yes') RS.addEvidence(states[rv] || (states[rv] = RS.newRootState(userId, rv)), 'chat', 0.5, sink, { event_id: `${kind}:${rv}:${chatId || at}`, chat_id: chatId, at, meta: { [kind === 'cause' ? 'cause_of' : 'rival_of']: q.roots[0] } });
  return { asked: q.group, given: answer === 'yes' ? [[rv, 0.5]] : [], add_root: answer === 'yes' ? rv : null, ruled_out: answer === 'no' ? rv : null };
}

/** ② 끝 뿌리가 없는 길(상태·여건·선호·마음으로 끝남): 끝 보기 종류에 맞는 가설 확인 질문 — "지나가는 일 / 여건만 풀리면 됨 / 취향"인지 "되풀이되는 패턴"인지 */
export function conditionQuestion(pathOptionIds = [], options = {}, tc = {}, asked = new Set()) {
  if (!tc.fallback) return null;
  const kind = options[pathOptionIds.at(-1)]?.kind, q = (P.condition_questions || []).find(x => x.end_kind === kind); if (!q) return null;
  const id = `CD:${pathOptionIds.at(-1)}`; if ((asked instanceof Set ? asked : new Set(asked)).has(id)) return null;
  return { type: 'condition', group: id, end_kind: kind, roots: (tc.roots || []).slice(0, 1), ask: q.ask, options: q.options };
}
/** 답: once(지나감·여건·취향) → 그 가설을 받아들임(뿌리 과제 대신 가벼운 과제 그대로) · repeat(되풀이) → 갈래 1위 뿌리 +0.5, 그 뿌리로 과제를 다시 고름(use_root) */
export function applyCondition(states, userId, q, answer, sink, chatId = null, at = new Date().toISOString()) {
  const r = q.roots?.[0];
  if (answer === 'repeat' && r && q.source !== 'judged_data') RS.addEvidence(states[r] || (states[r] = RS.newRootState(userId, r)), 'chat', 0.5, sink, { event_id: `cond:${q.group}:${chatId || at}`, chat_id: chatId, at, meta: { condition: q.end_kind } });
  // v0.8(11-16): 지나가는 일(once)이면 끝 보기의 갈 곳(sw_ob_end_conditions) — 여건: 환경 쪽 실천 · 상태: 그 상태 뿌리의 회복 실천 · 선호: 그 선호(자원 뿌리)를 살리는 실천 · 없으면 가벼운 과제
  const ec = answer === 'once' ? (P.end_conditions?.[String(q.group || '').replace(/^CD:/, '')] || { route: 'light', root: null }) : null;
  return { asked: q.group, hypothesis: answer === 'once' ? 'condition' : answer === 'repeat' ? 'pattern' : null, use_root: answer === 'repeat' ? r || null : null, route: ec ? ec.route : null, condition_root: ec ? ec.root : null };
}
/**
 * v0.6(11-15): 끝 뿌리가 없는 길 — 묻기 전에 엔진이 먼저 판단. 판단이 서면 { answer: 'once'|'repeat' }를, 근거가 모자라면 null을 돌려줌(null이면 conditionQuestion으로 물음).
 * ctx = { temporals: 이 대화에서 분류기가 붙인 claim의 temporal 목록('habitual'|'recent'|'now'|'past_over') · stageSignals: 단계 신호 id 목록('AC-3' · 'RS-3' 등 left)
 *         rootStates: 뿌리 상태(장부) · history: 예전 고민 [{ concern_id, roots, at }] · recentChange: 최근 1년 변화(recent_changes에 none 아닌 답) }
 * 본인 말에서 온 근거(said)와 쌓인 자료에서 온 근거(data)를 따로 셈. 차이가 PCFG.judge.min 이상일 때만 판단함.
 */
export function judgeCondition(pathOptionIds = [], options = {}, tc = {}, ctx = {}) {
  if (!tc.fallback) return null;
  const J = PCFG.judge, kind = options[pathOptionIds.at(-1)]?.kind, r = (tc.roots || [])[0] || null, why = { repeat: [], once: [] };
  let rep = 0, once = 0, saidRep = 0, saidOnce = 0; const add = (side, pts, said, text) => { if (side === 'repeat') { rep += pts; if (said) saidRep += pts; } else { once += pts; if (said) saidOnce += pts; } why[side].push(text); };
  const T = ctx.temporals || [], hab = T.filter(x => x === 'habitual').length, rec = T.filter(x => x === 'recent').length, over = T.filter(x => x === 'past_over').length;
  if (hab) add('repeat', J.said, true, '본인이 늘·자주 그렇다고 말함');
  if ((ctx.stageSignals || []).some(x => x === 'AC-3' || x === 'RS-3')) add('repeat', J.saidWeak, true, '"원래 그런 사람"처럼 말함');
  if (!hab && rec) add('once', J.said, true, '본인이 요즘·최근 일이라고 말함');
  if (!hab && over) add('once', J.saidWeak, true, '이미 지나간 일로 말함');
  const st = r && ctx.rootStates ? ctx.rootStates[r] : null;
  if (st && st.status !== 'rejected') { if (st.status === 'confirmed' || (st.score || 0) >= J.scoreHi) add('repeat', J.data * 2, false, '갈래 1위 뿌리에 이미 근거가 많이 쌓임'); else if ((st.score || 0) >= J.scoreLo) add('repeat', J.data, false, '갈래 1위 뿌리에 근거가 쌓여 있음'); }
  const H = ctx.history || [], sk = ctx.sceneKey || null, sameScene = sk ? H.filter(h => h.concern_id === sk).length : 0, sameRoot = r ? H.filter(h => h.concern_id !== sk && (h.roots || []).includes(r)).length : 0;
  if (sameScene) add('repeat', Math.min(2, sameScene) * J.data, false, `같은 고민이 예전에도 ${sameScene}번 있었음`);
  if (sameRoot) add('repeat', J.data, false, '다른 고민에서도 같은 뿌리가 나옴');
  if (ctx.recentChange && (kind === '상태' || kind === '여건')) add('once', J.data, false, '최근 1년 안에 큰 변화가 있었음');
  const d = rep - once, answer = d >= J.min ? 'repeat' : d <= -J.min ? 'once' : null; if (!answer) return null;
  const said = answer === 'repeat' ? saidRep : saidOnce;
  return { type: 'condition', group: `CD:${pathOptionIds.at(-1)}`, end_kind: kind, roots: r ? [r] : [], answer, source: said >= J.saidWeak ? 'judged_said' : 'judged_data', reasons: why[answer], against: why[answer === 'repeat' ? 'once' : 'repeat'], margin: d };
}
/** v0.6: 판단 먼저, 안 서면 질문 — { judged } 또는 { question } 또는 null(이미 다룬 길) */
export function resolveCondition(pathOptionIds = [], options = {}, tc = {}, ctx = {}, asked = new Set()) {
  if (!tc.fallback) return null; const id = `CD:${pathOptionIds.at(-1)}`; if ((asked instanceof Set ? asked : new Set(asked)).has(id)) return null;
  const j = judgeCondition(pathOptionIds, options, tc, ctx); if (j) return { judged: j };
  const q = conditionQuestion(pathOptionIds, options, tc, asked); return q ? { question: q } : null;
}
/** repeat이면 그 뿌리의 실천을 과제 후보 맨 앞 점수로 올림(taskCandidates 결과에) */
/** v0.10(11-23): 기본 갈래 가설(갈래를 모를 때 ssol_case.taskCandidates가 넣은 후보 · from 'branch')은 뿌리가 확인되면(되풀이 답 · 고른 기저 생각) 거둠 — 가설은 다른 근거가 없을 때만 씀 */
function dropHypo(tc) { if (!tc?.branch || tc.branch.known || !tc.branch.in_candidates) return; const h = new Set(tc.branch.roots || []);
  tc.candidates = tc.candidates.filter(c => c.from !== 'branch'); tc.relRoots = (tc.relRoots || []).filter(r => !h.has(r) || (tc.roots || []).includes(r)); tc.branch.in_candidates = false; }
export function useRoot(tc, root, caseData) {
  if (!root) return tc; dropHypo(tc); const at = new Map(tc.candidates.map(c => [c.practice_id, c]));
  for (const x of caseData?.root_practices?.[root] || []) { const c = at.get(x.practice_id); if (c) c.score = Math.max(c.score, 1.2); else tc.candidates.push({ practice_id: x.practice_id, score: 1.2, from: 'pattern' }); }
  tc.roots = [root, ...(tc.roots || []).filter(r => r !== root)]; tc.fallback = false; return tc;
}

/** ④ 대화 안에서 바로 해 보기: 고른 과제 중 지금 1~3분에 할 수 있는 것(in_session) 하나 → 하고 나면 바로 확인 질문. 없으면 같은 뿌리의 맛보기 실천(extra) · 그것도 없으면 null */
export function miniExperiment(tasks = [], cs = null, roots = [], person = {}) {
  const S = new Set(P.in_session || []); let t = tasks.find(x => S.has(x.practice_id)), extra = false;
  if (!t && cs && roots.length) {   // 고른 과제 중에 없으면, 같은 뿌리에 이어진 "지금 해 볼 수 있는" 실천 하나(과제 2개와 따로 · 맛보기)
    const want = cs.stage === '알아차림' ? ['관찰', '수용'] : cs.stage === '받아들임' ? ['수용', '관찰'] : ['수용', '관찰', '통합'], rk = k => { const i = want.indexOf(STAGE_OF?.[k]); return i < 0 ? 9 : i; };   // v0.6: 지금 단계에 맞는 것 먼저 · 끝 뿌리 순서대로
    const ri = k => { const i = roots.findIndex(r => (ROOTS_OF[k] || []).includes(r)); return i < 0 ? 9 : i; };
    const sc = scorer(cs, person), id = [...S].filter(k => (ROOTS_OF[k] || []).some(r => roots.includes(r)) && !sc(k).exclude).sort((x, y) => (ri(x) - ri(y)) || (rk(x) - rk(y)) || (sc(y).adj - sc(x).adj) || (x < y ? -1 : 1))[0];
    if (id) { t = { practice_id: id, stage: STAGE_OF?.[id] || null, root: (ROOTS_OF[id] || []).find(r => roots.includes(r)) }; extra = true; }
  }
  if (!t) return null;
  const z = sizeOf(t.practice_id) || {};
  return { practice_id: t.practice_id, title: P.titles?.[t.practice_id] || t.practice_id, minutes: z.max || null, extra, invite: `지금 ${z.max || 1}분만 같이 해 볼까요?`, options: ['지금 해 볼게요', '나중에 할게요'], first_step: firstStepOf(t.practice_id), check: checkFor(t), row: { in_session: true, check_root: t.root || null } };
}

/** ⑤ 가설 측정 요약(한 사용자): 세운 가설(근거가 한 번이라도 들어간 뿌리) 중 확인 문장 답 · 가르는/겨루는/여건 질문 · 과제 확인 답 중 하나라도 거친 비율 */
export function measuredHypotheses(states = {}, askedRows = [], tasks = []) {
  const raised = Object.values(states).filter(s => (s.ledger || []).some(e => e.validity !== 'superseded') || s.score > 0).map(s => s.root_id);
  const by = {}; const mark = (r, k) => { if (r) (by[r] = by[r] || new Set()).add(k); };
  for (const s of Object.values(states)) if (s.answer === 'accepted' || s.answer === 'rejected' || ['confirmed', 'rejected'].includes(s.status)) mark(s.root_id, 'confirm');
  for (const a of askedRows) for (const r of a.roots || []) mark(r, a.group_id?.startsWith('CD:') ? 'condition' : a.group_id?.startsWith('RV:') ? 'rival' : 'discriminator');
  for (const t of tasks) if (t.check_root && t.check_answer && t.check_answer !== '잘 모르겠어요') mark(t.check_root, 'task');
  const all = [...new Set([...raised, ...Object.keys(by)])], m = all.filter(r => by[r]);
  return { raised: all.length, measured: m.length, rate: all.length ? +(m.length / all.length).toFixed(3) : null, by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...v]])) };
}

/* ───────── v0.7(11-15): 연결고리 점검 ───────── */
/** 겨루는 가설에 "아니요" → 이 고민 안에서는 그 뿌리를 2위 후보·과제 후보에서 뺌(점수는 깎지 않음). res = applyRival 결과 */
export function noteRuledOut(cs, res) { if (cs && res?.ruled_out && !(cs.ruled_out || []).includes(res.ruled_out)) cs.ruled_out = [...(cs.ruled_out || []), res.ruled_out]; return cs; }
/** 과제 결과 → 그 사람에게 통한 이론: 같은 이론 과제가 2번 이상 "조금 나아졌어요" → prefer · 나아진 적 없이 2번 이상 "그대로예요"·"더 버거웠어요" → avoid(빼지는 않고 뒤로) */
export function theoryFromTasks(tasks = []) {
  const n = {}; for (const t of tasks) { const th = TH_OF[t.practice_id]; if (!th || !t.check_answer) continue; const x = n[th] = n[th] || { better: 0, same: 0 };
    if (t.check_answer === '조금 나아졌어요') x.better++; else if (t.check_answer === '그대로예요' || t.check_answer === '더 버거웠어요') x.same++; }
  return { prefer: Object.keys(n).filter(k => n[k].better >= PCFG.taskTheory.min), avoid: Object.keys(n).filter(k => !n[k].better && n[k].same >= PCFG.taskTheory.min), counts: n };
}
/** person에 과제 결과로 본 이론을 더함(온보딩에서 온 선호·제외는 그대로) — lensFor · applyCardPath의 person으로 넘김 */
export function withTaskTheory(person = {}, tasks = person.tasks || []) {
  const t = theoryFromTasks(tasks), ex = new Set(person.theoryExclude || []);
  return { ...person, theoryPrefer: [...new Set([...(person.theoryPrefer || []), ...t.prefer.filter(x => !ex.has(x))])], theoryAvoid: t.avoid };
}
/** 카드 길이 없는 자유 대화에서 쓸 뿌리: 장부 점수가 높은 순 n개(아니라고 한 뿌리 · 결핍·자원·기질 뿌리는 뺌 · 점수 PCFG.freeTalk.min 이상) — taskCandidates([], options, { roots }) */
/** v0.11(11-23 · 규칙 ROOT-CAUSE-1123): 결과형 뿌리(r1)에 앞서는 원인 뿌리가 있으면 그 원인 뿌리의 예·아니요 확인 질문을 한 번 — 답은 applyRival(같은 꼴: 예 +0.5 · 아니요 ruled_out)
 *  asked = 이미 물은 id · rejected = 아니라고 한 뿌리 · 원인 뿌리는 결과형 뿌리를 대신하지 않음(둘 다 맞을 수 있음) */
export function causeQuestion(r1, asked = new Set(), rejected = []) {
  const A = asked instanceof Set ? asked : new Set(asked), rej = new Set(rejected);
  for (const c of (P.root_causes?.[r1] || [])) { const id = `CA:${c}`; if (rej.has(c) || A.has(id) || !P.root_check?.[c]) continue;
    return { type: 'cause', group: id, roots: [r1, c], ask: P.root_check[c], options: [{ text: '네, 그런 편이에요', answer: 'yes' }, { text: '아니요, 그건 아니에요', answer: 'no' }, { text: '잘 모르겠어요', answer: null }] }; }
  return null;
}
export function freeTalkRoots(states = {}, n = 3) {
  return Object.values(states).filter(s => s && s.status !== 'rejected' && (s.score || 0) >= PCFG.freeTalk.min && RIVAL_LAYERS.includes(P.root_layer?.[s.root_id])).sort((a, b) => (b.score - a.score) || (a.root_id < b.root_id ? -1 : 1)).slice(0, n).map(s => s.root_id);
}

/* v0.10(11-23): useRoot · useThoughtRoots — 뿌리가 확인되면 기본 갈래 가설 후보를 거둠(dropHypo) */
/* ───────── v0.9(11-18 · CSO: 기저 생각을 짚은 뒤 해결책을 바로 제안 · 기저 생각은 여러 개): 기저 생각 → 뿌리 → 과제 ───────── */
/** 기저 생각 확인 카드 답을 장부에: res = ssol_worry_match.thoughtPick(intentId, pick). 고른 뿌리 +1(둘 다면 +0.5씩 · 출처 chat) · 결핍층은 점수 없음.
 *  돌려준 add_roots를 useThoughtRoots(tc, add_roots, caseData)에 넘기면 그 뿌리의 실천이 과제 후보 앞에 옴 */
export function applyThought(states, userId, res, sink, chatId = null, at = new Date().toISOString()) {
  const given = [];
  for (const [r, p] of res?.score || []) { RS.addEvidence(states[r] || (states[r] = RS.newRootState(userId, r)), 'chat', p, sink, { event_id: `thought:${res.intent_id}:${chatId || at}:${r}`, chat_id: chatId, at, meta: { thought: res.intent_id, pick: res.pick } }); given.push([r, p]); }
  return { asked: `thought:${res?.intent_id}`, given, add_roots: given.slice().sort((a, b) => b[1] - a[1]).map(x => x[0]), guess: res?.guess || [] };
}
/** 기저 생각의 뿌리 여러 개를 과제 후보에: roots = 뿌리 id 배열(앞이 먼저) 또는 thoughtCandidates 결과([{ root_id, w }]). 첫 뿌리 실천 1.2 · 그다음부터 0.1씩 낮게(1.0 밑으로는 안 내려감) · 아니라고 한 뿌리는 뺌 */
export function useThoughtRoots(tc, roots = [], caseData, ruledOut = []) {
  const ids = roots.map(r => typeof r === 'string' ? r : r?.root_id).filter(r => r && !ruledOut.includes(r)); if (!ids.length) return tc;
  dropHypo(tc);
  const at = new Map(tc.candidates.map(c => [c.practice_id, c]));
  ids.forEach((root, i) => { const sc = Math.max(1.0, 1.2 - 0.1 * i);
    for (const x of caseData?.root_practices?.[root] || []) { const c = at.get(x.practice_id); if (c) c.score = Math.max(c.score, sc); else { const n = { practice_id: x.practice_id, score: sc, from: 'thought' }; tc.candidates.push(n); at.set(x.practice_id, n); } } });
  tc.roots = [...ids, ...(tc.roots || []).filter(r => !ids.includes(r))]; tc.fallback = false; return tc;
}

/* ───────── v0.8(11-16): 지나가는 일로 본 길의 해결책 ───────── */
/** applyCondition 결과를 과제 후보에 이음: 되풀이 → useRoot(갈래 1위 뿌리) · 지나감 → 여건·상태·선호 뿌리가 있으면 그 뿌리의 실천을 앞에(끝 뿌리처럼), tc.route를 pickTasks의 route로 넘김
 *  route: environment(환경 쪽 행동 하나 + 단계 과제) · recovery · preference · light(가벼운 과제 먼저) */
export function useCondition(tc, res, caseData) {
  if (!res) return tc;
  if (res.use_root) return useRoot(tc, res.use_root, caseData);
  if (res.hypothesis !== 'condition') return tc;
  if (res.condition_root) useRoot(tc, res.condition_root, caseData);
  tc.route = res.route || 'light'; tc.hypothesis = 'condition'; tc.conditionRoot = res.condition_root || null; return tc;   // pickTasks에 { route: tc.route, conditionRoot: tc.conditionRoot }로 넘김
}
