// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v2.7/ssol_motive_v0.2.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 동기 위치 · 즐거움·몰입·의미 v0.1 (ESM) — 제1장 1-3-4(자기결정이론)·1-2-4(Seligman) 반영(CSO 10-27 · G2·G5)
 *  - motiveSignals: 고른 보기·분류된 claim의 동기 위치 → sw_user_signals motive.<영역> (뿌리 점수 없음 · MV-01)
 *  - currentMotive / motiveShiftLine: 영역별 현재 위치 · "해야만 해 → 하고 싶어" 쪽으로 옮겨 가면 리포트 한 줄(MV-02·04)
 *  - motiveFit: 위치에 맞는 실천 +0.5 (MV-03 · rootBoost의 ctx.motivePosition)
 *  - pathBalance: 최근 7개 추천이 한 갈래로만 채워졌으면 다른 갈래를 앞으로(RC-21)
 * 데이터: setMotiveData({ claims: sw_ob_claims(motive 칸), sceneDomains: sw_ob_scene_domains, positions: sw_ob_motive_positions })
 */
let MOTIVE = {}, DOMAIN = {}, ORD = { external: 1, introjected: 2, identified: 3, integrated: 4 };
const DAY = 86400000, _t = x => (x instanceof Date ? x.getTime() : typeof x === 'number' ? x : Date.parse(x));
export const SHIFT_LINE = '‘해야만 해’에서 ‘하고 싶어’ 쪽으로 조금씩 옮겨 가고 있어요.';
export function setMotiveData({ claims = [], sceneDomains = [], positions = [] } = {}) {
  MOTIVE = Object.fromEntries(claims.filter(c => c.motive).map(c => [c.claim_id, c.motive]));
  DOMAIN = Object.fromEntries(sceneDomains.map(r => [r.scene_key, r.domain]));
  if (positions.length) ORD = Object.fromEntries(positions.map(p => [p.position, p.ord]));
  return { claims: Object.keys(MOTIVE).length, scenes: Object.keys(DOMAIN).length };
}
export const domainOf = scene => DOMAIN[scene] || 'general';

/** claimIds: 고른 보기의 claim · 분류된 claim. ctx = { userId, chatId, at, scene, suggestedByAi } — 해당 없음·모름은 기록 안 함 */
export function motiveSignals(claimIds, ctx = {}) {
  if (ctx.suggestedByAi) return [];
  const out = [], dom = domainOf(ctx.scene);
  for (const id of claimIds || []) {
    const m = MOTIVE[id]; if (!ORD[m]) continue;
    out.push({ user_id: ctx.userId, slot: `motive.${dom}`, source: 'chat', observed_at: ctx.at, ref: ctx.chatId, value: { position: m, claim_id: id, scene: ctx.scene || null } });
  }
  return out;
}
const _live = (signals, domain, now, W) => (signals || []).filter(s => s.slot === `motive.${domain}` && !s.retracted_at && !s.hidden_at && (!W || _t(s.observed_at) > now - W))
  .sort((a, b) => _t(a.observed_at) - _t(b.observed_at));
/** MV-02: 영역의 현재 위치(최근 30일 중 가장 최근) */
export function currentMotive(signals, domain, opts = {}) {
  const now = _t(opts.now ?? Date.now()), xs = _live(signals, domain, now, (opts.windowDays ?? 30) * DAY);
  return xs.length ? xs[xs.length - 1].value.position : null;
}
/** MV-04: 그 영역의 첫 기록보다 지금 위치가 “하고 싶어” 쪽이면 한 줄 — 반대로 갔다는 말은 안 함 */
export function motiveShiftLine(signals, domain, opts = {}) {
  const now = _t(opts.now ?? Date.now()), all = _live(signals, domain, now, 0);
  if (all.length < 2 || new Set(all.map(s => s.ref || s.observed_at)).size < 2) return '';   // v0.2(10-28 시뮬 #9): 서로 다른 대화 2번 이상일 때만 · CF-3·정정한 세션의 신호는 서버가 retracted_at으로 거둠
  const first = ORD[all[0].value.position], last = ORD[currentMotive(signals, domain, opts)] || 0;
  return last > first ? SHIFT_LINE : '';
}
/** MV-03: practice.motive_fit = ['introjected', …] (sw_ob_practice_flags) */
export const motiveFit = (practice, position) => (position && (practice.motive_fit || []).includes(position) ? 0.5 : 0);

/**
 * RC-21: ranked = [{ id, score, path }] 높은 점수순 · recentPaths = 최근 추천 실천의 갈래(최신이 끝) · opts = { window: 7, bodyHold }
 * 최근 window개가 모두 한 갈래면, 1위와 점수 차 1 이내인 다른 갈래 실천을 맨 앞으로. 몸 단계면 pleasure를 먼저.
 */
export function pathBalance(ranked, recentPaths = [], opts = {}) {
  const r = [...(ranked || [])]; if (r.length < 2) return r;
  const want = opts.bodyHold ? 'pleasure' : null, top = r[0].score;
  const pick = pred => { const i = r.findIndex((x, k) => k > 0 && x.score >= top - 1 && pred(x)); if (i > 0) r.unshift(r.splice(i, 1)[0]); return i > 0; };
  if (want && r[0].path !== want && pick(x => x.path === want)) return r;
  const w = recentPaths.slice(-(opts.window ?? 7));
  if (w.length >= (opts.window ?? 7) && new Set(w).size === 1 && r[0].path === w[0]) pick(x => x.path && x.path !== w[0]);
  return r;
}
