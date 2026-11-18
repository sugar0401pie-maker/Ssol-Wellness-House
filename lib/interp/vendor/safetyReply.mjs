// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.23/ssol_safety_reply_v0.3.js (수정 없음) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 안전 신호 뒤의 응답 v0.3 (2026-11-18)
 * v0.3(CSO 11-18): 마이페이지 안내 + 버튼은 어떤 신호든 "힘든 메시지 4번째"로 통일(바로 붙이는 경우 없음) · 확인 질문 없음.
 * v0.2: 대화에서는 연락처를 말하지 않음(119 포함) — 마이페이지 안내 + "마이페이지로 가기" 버튼.
 * v0.1: 고정 안내문을 쓰지 않고 공감하고 듣기 · 같은 문장 두 번 안 씀 · 되풀이 불만엔 사과하고 듣기
 * 판단은 하지 않음 — lib/safety가 준 신호 코드를 받아 "무엇을 말할지"만 정함. 원문은 남기지 않고 갈래·쓴 문장 id만 남김
 * 데이터: sw_ob_safety_reply_tiers(어떤 문장 묶음을 쓸지) · sw_ob_safety_replies · sw_ob_help_resources(마이페이지에 늘 게재)
 */
let D = { tiers: {}, replies: [], resources: [] };
export const CFG = { heavyTurnsForPointer: 4, pointerOnce: true, followTurns: 6,
  button: { type: 'button', label: '마이페이지로 가기', target: 'mypage_help' },   // 온보딩 테스트 하기 버튼과 같은 방식
  rank: { emergency: 6, direct: 5, violence: 4, violence_soft: 2, listen: 1 } };
const REPAIR = /같은 ?말만|똑같은 ?말|왜 ?(내|제) ?(얘기|이야기|말)(를|을|는|은)? ?안 ?들|(내|제) ?(얘기|이야기)(에|를|좀)? ?(대답|들어)|너 ?때문에 ?(마음|기분)이? ?더|무슨 ?대화를|대답해 ?(줘|주)|안내 ?그만|그만 ?안내/;
export function setReplyData(d = {}) { D = { tiers: Object.fromEntries((d.tiers || []).map(t => [t.signal_id, t.tier])), replies: d.replies || [], resources: d.resources || [] }; return D; }
export function newReplyState() { return { used: [], pointer: false, crisisTurns: 0, heavyTurns: 0, lastTier: null, lastGroup: null, sinceSignal: 0 }; }
const groupOf = tier => tier?.startsWith('violence') ? 'violence' : 'heavy';
export function tierOf(codes = []) { let best = null; for (const c of codes) { const t = D.tiers[c]; if (t && (!best || CFG.rank[t] > CFG.rank[best])) best = t; } return best; }
function pick(st, grp, stage) {
  const pool = D.replies.filter(r => r.grp === grp && r.stage === stage); if (!pool.length) return null;
  const r = pool.find(x => !st.used.includes(x.reply_id)) || pool[st.used.filter(id => pool.some(p => p.reply_id === id)).length % pool.length];
  st.used.push(r.reply_id); return { kind: stage, reply_id: r.reply_id, text: r.text };
}
function pointer(st, grp, parts) { if (CFG.pointerOnce && st.pointer) return; const p = pick(st, grp, 'pointer') || pick(st, 'heavy', 'pointer'); if (p) { parts.push({ ...p, action: { ...CFG.button } }); st.pointer = true; } }
/** 한 턴의 응답 계획. input = { codes: lib/safety 신호 코드 배열, heavy: 힘듦을 직접 쓴 메시지인지(예: WM.signalsOf(text).intensity.kinds에 'feeling'), text: 이번 메시지(되풀이 불만 확인용 · 저장 안 함) }
 *  → { mode: 'safety'|'repair'|'follow'|'normal', tier, parts:[{kind,text,reply_id,action?}], fixed_guide:false, contacts_in_chat:false, log }
 *  pointer(마이페이지 안내 + 버튼)는 힘든 메시지가 4번째일 때 한 번만 — mode가 'normal'이어도 올 수 있음(평소 답 끝에 붙임) */
export function planReply(st, input = {}) {
  const tier = tierOf(input.codes || []); const parts = [];
  const out = (mode, t = tier) => ({ mode, tier: t, parts, fixed_guide: false, contacts_in_chat: false, log: { tier: t, heavy_turns: st.heavyTurns, parts: parts.map(p => p.kind) } });
  const push = p => { if (p) parts.push(p); };
  if (tier || input.heavy) st.heavyTurns++;
  const due = st.heavyTurns >= CFG.heavyTurnsForPointer;
  if (!tier) {
    const g = st.lastGroup || 'heavy';
    if (st.lastTier && REPAIR.test(String(input.text || ''))) { push(pick(st, 'any', 'repair')); return out('repair', st.lastTier); }
    if (st.lastTier && st.sinceSignal < CFG.followTurns) { st.sinceSignal++; push(pick(st, g, 'follow')); if (due) pointer(st, g, parts); return out('follow', st.lastTier); }
    if (due) pointer(st, 'heavy', parts);
    return out('normal', null);
  }
  const grp = groupOf(tier); st.crisisTurns++; st.sinceSignal = 0; if (!st.lastTier || CFG.rank[tier] >= CFG.rank[st.lastTier]) st.lastTier = tier; st.lastGroup = grp;
  if (REPAIR.test(String(input.text || ''))) push(pick(st, 'any', 'repair'));
  else { push(pick(st, tier === 'emergency' ? 'emergency' : grp, 'empathy') || pick(st, grp, 'empathy')); push(pick(st, grp, st.crisisTurns === 1 ? 'listen' : 'follow')); }
  if (due) pointer(st, grp, parts);
  return out('safety');
}
/** 마이페이지 ‘도움받을 곳’ — 늘 게재(전화번호·마들랜 카카오톡 링크는 여기에만) */
export function helpResources() { return [...D.resources].sort((a, b) => (+a.sort || 0) - (+b.sort || 0)); }
