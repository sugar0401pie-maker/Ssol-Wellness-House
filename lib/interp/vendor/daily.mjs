// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.43/ssol_daily_v0.2.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 오늘의 제안 v0.1 (2026-11-26 · CSO · DB v5.36 · 규칙 DAILY-01)
 *  홈의 「이렇게 해보면 어떨까요?」와 대화 속 과제가 같은 기준으로 나오게 하는 함수 하나 — dailySuggestion
 *  고르는 순서(CSO 11-26 「타로나 다른 테스트에서 먼저 받은 자료 있으면 그거 중심으로 먼저」):
 *   ① 타로 계획의 오늘 칸(1·2·3일차 · 1주일 · 1달) → ② 타로가 준 세부 고민·갈래 → ③ 다른 테스트(점성술·심리테스트)가 준 세부 고민·뿌리
 *   → ④ 최근 대화에서 확인된 고민(고민 상태 + 과제 후보) → ⑤ 온보딩 「가장 중요하게 생각하는 것」 = 관심 분야의 세부 고민(기본 갈래) → 없으면 null
 *  ②~⑤는 모두 ssol_case.pickTasks로 고름(갈래 · 뿌리 · 단계 · 대처 방식 · 온보딩에서 빼 달라고 한 활동 · 지난 과제 기록). 최근에 나간 것·이미 한 것은 뺌.
 */
import * as CS from './case.mjs'; import * as PS from './personal.mjs'; import * as CH from './challenge.mjs';

export const DAILY_CFG = { recentN: 7, valuesN: 3 };
const SLOT = { 1: 'day1', 2: 'day2', 3: 'day3', day1: 'day1', day2: 'day2', day3: 'day3', week: 'week', month: 'month' };
const info = id => CH.challengeData().practices?.[id] || {};

function pickFrom(tc, args, skip, meta) {
  const person = args.person || {}, cs = args.cs && meta.source === 'conversation' ? args.cs : CS.newConcernState(args.userId || 'u', meta.scene || 'free');
  if (meta.source !== 'conversation') { CS.applyCardPath(cs, [], tc.roots || [], {}); PS.fillCoping(cs, person); }
  const cands = (tc.candidates || []).filter(c => !skip.has(c.practice_id));
  const tasks = CS.pickTasks(cs, cands, { fallback: tc.fallback, relRoots: tc.relRoots, causeRoots: (tc.cause_roots || []).map(x => x.root_id), personal: PS.scorer(cs, person, meta.intent_id || tc.intentId || null), formatOf: PS.sizeOf });   // v0.2: 배우자와의 고민이면 배우자가 있다고 봄
  const t = tasks.find(x => !skip.has(x.practice_id)); if (!t) return null;
  return { ...meta, practice_id: t.practice_id, title: info(t.practice_id).title || null, description: info(t.practice_id).description || null, roots: (tc.roots || []).slice(0, 3), stage: cs.stage };
}

/**
 * args = { tarot: { plan, day, intentId, branchId }, tests: [{ name, intentId, branchId, roots }], cs, tc(최근 대화), person(personFromOnboarding 결과), options(선택 카드 보기), recent: [최근 나간 practice_id], done: [한 practice_id], dayIndex }
 * → { source: 'tarot_plan' | 'tarot' | 'test' | 'conversation' | 'interest', why, practice_id, title, description, … } | null
 */
export function dailySuggestion(args = {}) {
  const skip = new Set([...(args.recent || []).slice(-DAILY_CFG.recentN), ...(args.done || [])]), options = args.options || {};
  const tar = args.tarot || null;
  // ① 타로 계획의 오늘 칸
  if (tar?.plan && SLOT[tar.day]) { const p = CH.fromTarotPlan(tar.plan), s = p?.[SLOT[tar.day]]; if (s?.title) return { source: 'tarot_plan', why: `타로 계획의 ${SLOT[tar.day]} 칸`, slot: SLOT[tar.day], practice_id: s.practice_id || null, title: s.title, description: s.description || null }; }
  // ② 타로가 준 세부 고민·갈래
  if (tar?.intentId) { const tc = CS.taskCandidates([], options, { intentId: tar.intentId, branchId: tar.branchId || null }); const r = pickFrom(tc, args, skip, { source: 'tarot', why: `타로에서 받은 세부 고민 ${tar.intentId}${tar.branchId ? ' · 갈래 ' + tar.branchId : ''}`, intent_id: tar.intentId, branch_id: tar.branchId || null }); if (r) return r; }
  // ③ 다른 테스트가 준 세부 고민·뿌리
  for (const t of args.tests || []) { const tc = t.intentId ? CS.taskCandidates([], options, { intentId: t.intentId, branchId: t.branchId || null }) : (t.roots || []).length ? CS.taskCandidates([], options, { roots: t.roots }) : null; if (!tc) continue;
    const r = pickFrom(tc, args, skip, { source: 'test', test: t.name || null, why: `${t.name || '테스트'}에서 받은 ${t.intentId ? '세부 고민 ' + t.intentId : '뿌리 ' + t.roots.slice(0, 3).join('·')}`, intent_id: t.intentId || null, branch_id: t.branchId || null }); if (r) return r; }
  // ④ 최근 대화
  if (args.tc && (args.tc.candidates || []).length) { const r = pickFrom(args.tc, args, skip, { source: 'conversation', why: '최근 대화에서 확인된 고민', intent_id: args.tc.branch?.intent_id || null, branch_id: args.tc.branch?.branch_id || null }); if (r) return r; }
  // ⑤ 온보딩 관심 분야 → 세부 고민(기본 갈래)
  const interest = CH.challengeData().interest_subs || {}, vals = (args.person?.prefs?.values || []).slice(0, DAILY_CFG.valuesN);
  for (const v of vals) { const subs = interest[v] || []; if (!subs.length) continue; const k = (args.dayIndex || 0) % subs.length;
    for (const sub of [...subs.slice(k), ...subs.slice(0, k)]) { const tc = CS.taskCandidates([], options, { intentId: sub }); const r = pickFrom(tc, args, skip, { source: 'interest', why: `온보딩 관심 분야 ${v} → 세부 고민 ${sub}`, intent_id: sub, branch_id: null, option_key: v }); if (r) return r; } }
  return null;
}
