// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_쏘웰라_해석엔진_ESM_v3.31/ssol_report_reply_v0.1.js (수정 없음 — 다른 보관본을 가리키게 import 경로만 바꿈) ───
// 원본이 새 버전으로 오면 이 파일을 새로 복사한다. 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 — 리포트(타로·점성술·사주)와 이어진 말에 답하기 v0.1 (2026-11-18 · CSO 결정)
 *  ① 물은 것에 먼저 답(본 리포트의 말을 인용·활용) → ② 다음 문단: 기저 생각 → ③ 심리 이론으로 풀기 → ④ 해결책 바로 제안 (규칙 RP-01~04 · WT-01)
 *  이 모듈은 "무엇을 어떤 순서로 말할지"만 정함. 문장을 쓰는 것은 응답 모델 — parts[].guide와 재료(text · quote_from · theory)를 프롬프트에 넣어 씀.
 *  데이터: setReportReplyData({ cues, theories }) — DB sw_ob_report_cues · sw_ob_theory_lines (시험용 data/report_reply_v0.1.json)
 *  기저 생각·뿌리는 ssol_worry_match v0.5, 이론은 case 데이터(root_theory · scene_lens · practice_theory)에서 읽음.
 */
import * as WM from './worryMatch.mjs';

let D = { cues: [], theories: {} }, CUE = [];
export const CFG = { sources: ['tarot', 'astro', 'saju'], names: { tarot: '타로', astro: '점성술', saju: '사주' } };
export function setReportReplyData(d = {}) {
  D = { cues: d.cues || [], theories: Array.isArray(d.theories) ? Object.fromEntries(d.theories.map(t => [t.theory_id, t])) : (d.theories || {}) };
  CUE = D.cues.map(c => ({ ...c, re: new RegExp(c.pattern) })); return D;
}
const hasList = reports => Array.isArray(reports) ? reports.filter(s => CFG.sources.includes(s)) : CFG.sources.filter(s => reports && reports[s]);

/** 낱말 단서로 보기(분류기를 못 쓸 때): { sources: ['tarot', …], any: 어느 리포트인지 말하지 않고 결과를 가리킴, words: 걸린 말 } */
export function reportCue(text = '') {
  const s = String(text), src = [], words = []; let any = false;
  for (const c of CUE) { const m = s.match(c.re); if (!m) continue; words.push(m[0]); if (c.source === 'any') any = true; else if (!src.includes(c.source)) src.push(c.source); }
  return { sources: src, any, words };
}
/** 그 말이 어느 리포트와 이어지는지: 분류기 결과(cls.report_ref)가 있으면 그것, 없으면 낱말 단서. reports = 그 사람이 본 리포트(['tarot','astro'] 또는 { tarot: true })
 *  → { related, source, sources, seen, mention, asks, by } · 어느 리포트인지 말하지 않았고 본 리포트가 하나면 그것으로 봄(RP-02) */
export function reportRefOf(text = '', cls = null, reports = []) {
  const has = hasList(reports), ref = cls?.report_ref; let sources = [], mention = null, asks = false, by = null;
  if (ref && CFG.sources.includes(ref.source)) { sources = [ref.source]; mention = ref.mention || null; asks = !!ref.asks; by = 'classifier'; }
  else { const c = reportCue(text); sources = c.sources; mention = c.words[0] || null; by = c.sources.length || c.any ? 'cue' : null;
    if (!sources.length && c.any && has.length === 1) sources = [has[0]]; if (!sources.length && c.any && has.length > 1) sources = [...has];
    asks = by === 'cue' && /[?？]|까요|나요|인가요|건가요|뭐예요|뭔가요|무슨 ?뜻|어떤 ?의미|알려|궁금/.test(String(text)); }
  const seenSrc = sources.filter(s => has.includes(s));
  return { related: sources.length > 0, source: seenSrc[0] || sources[0] || null, sources, seen: seenSrc, mention, asks, by };
}
/** 풀어 갈 이론: 고른(또는 1순위) 기저 생각의 뿌리의 1순위 이론 → 장면의 고민 이론 → 그 세부 고민 실천의 주 이론(빈 곳 없게) */
export function theoryFor({ rootId = null, sceneKey = null, intentId = null } = {}, caseData = {}) {
  const lens = Array.isArray(caseData.scene_lens) ? caseData.scene_lens.find(l => l.scene_key === sceneKey) : caseData.scene_lens?.[sceneKey];
  let id = null, from = null;
  if (rootId && caseData.root_theory?.[rootId]?.length) { id = caseData.root_theory[rootId][0][0]; from = 'root'; }
  if (!id && lens?.default_theory) { id = lens.default_theory; from = 'scene'; }
  if (!id && intentId) { for (const x of caseData.worry_practices?.[intentId] || []) { const m = caseData.practice_theory?.[x.practice_id]?.main; if (m) { id = m; from = 'practice'; break; } } }
  const t = id && D.theories[id]; if (!t) return id ? { theory_id: id, name: null, line: null, text: null, from } : null;
  return { theory_id: id, name: t.name_chat, line: t.line, from, text: `심리학의 ${t.name_chat}에서는 이럴 때 이렇게 해 봐요. ${t.line}.` };
}
/** 더 깊은 층위: 그 뿌리로 이어지는 선택지 카드 끝 보기의 기저 생각(3층위). 같은 장면 것을 먼저, 없으면 다른 장면 것 — [{ option_id, core_thought, same_scene }] */
const _IDX = new WeakMap();
function _index(cards) {
  let x = _IDX.get(cards); if (x) return x;
  const byCard = {}; for (const o of Object.values(cards.options)) (byCard[o.card] = byCard[o.card] || []).push(o);
  const sceneOf = {}; for (const s of cards.scenes || []) { const st = [s.first_card]; while (st.length) { const c = st.pop(); if (!c || sceneOf[c]) continue; sceneOf[c] = s.key; for (const o of byCard[c] || []) if (o.next_card) st.push(o.next_card); } }
  const byRoot = {}; for (const o of Object.values(cards.options)) { if (!o.core_thought) continue; const direct = new Set((o.roots || []).map(r => r.root)); const all = new Set([...direct, ...(o.rank_roots?.[0] ? [o.rank_roots[0]] : [])]);
    for (const r of all) (byRoot[r] = byRoot[r] || []).push({ option_id: o.id, core_thought: o.core_thought, scene: sceneOf[o.card] || null, direct: direct.has(r) }); }
  x = { byRoot }; _IDX.set(cards, x); return x;
}
export function deeperThoughts(rootId, sceneKey, cards = {}, n = 3) {
  if (!rootId || !cards.options) return [];
  return (_index(cards).byRoot[rootId] || []).map(h => ({ option_id: h.option_id, core_thought: h.core_thought, same_scene: h.scene === sceneKey, direct: h.direct }))
    .sort((a, b) => (b.same_scene - a.same_scene) || (b.direct - a.direct) || (a.option_id < b.option_id ? -1 : 1)).slice(0, n);
}
/** 발화 → 해결책까지 한 줄로: 세부 고민의 기저 생각 하나(rank)가 어디까지 이어지는지 — 빈 곳 점검·테스트 사이트 연동용
 *  { intent_id, rank, thought, root_id, mode, theory, deeper[], practices[] } · practices: 그 뿌리의 실천(없으면 세부 고민의 실천) */
export function chainFor(intentId, rank, caseData = {}, cards = {}) {
  const t = WM.thoughtsFor(intentId).find(x => x.rank === rank); if (!t) return null; const r = WM.routeFor(intentId, caseData) || {};
  const scored = t.root_id && t.mode !== 'guess', root = scored ? t.root_id : null;
  const rp = root ? (caseData.root_practices?.[root] || []).map(x => x.practice_id) : [], wp = r.practices || [];
  return { intent_id: intentId, rank, thought: t.text, root_id: t.root_id, mode: t.mode, scene_key: r.scene_key || null, theory: theoryFor({ rootId: root, sceneKey: r.scene_key, intentId }, caseData),
    deeper: deeperThoughts(root, r.scene_key, cards), practices: rp.length ? rp : wp, practices_from: rp.length ? 'root' : 'intent' };
}
/** 응답 계획. inp = { text, cls(분류기 결과), reports(본 리포트), intentId, secondaryId, pick('first'|'second'|'both'|null), safety(이번 말이 lib/safety에 걸렸는지) }
 *  → { mode: 'report' | 'plain' | 'listen', ref, parts: [answer, thought, theory, solution] } */
export function planReply(inp = {}, caseData = {}) {
  const { text = '', cls = null, reports = [], intentId = null, secondaryId = null, pick = null, safety = false } = inp;
  if (safety) return { mode: 'listen', ref: null, parts: [], note: 'RP-04: 안전 신호가 있는 말 — ssol_safety_reply.planReply를 씀' };
  const ref = reportRefOf(text, cls, reports), parts = [], nm = s => CFG.names[s];
  if (ref.related && ref.seen.length) parts.push({ kind: 'answer', use: 'report', quote_from: ref.seen, mention: ref.mention,
    guide: `물은 것에 먼저 자연스럽게 답해요. ${ref.seen.map(nm).join('·')} 리포트에 나온 말을 한두 군데 인용하거나 자연스럽게 활용해요${ref.seen.length > 1 ? '(둘을 조합해도 돼요)' : ''}. 리포트에 없는 내용은 지어내지 않아요.` });
  else if (ref.related) parts.push({ kind: 'answer', use: 'not_seen', quote_from: [], mention: ref.mention,
    guide: `${ref.sources.map(nm).join('·')} 이야기를 꺼냈지만 그 리포트를 본 기록이 없어요. 내용을 지어내지 않고, 물은 고민 자체에 먼저 답해요.` });
  else parts.push({ kind: 'answer', use: 'general', quote_from: [], mention: null, guide: '물은 것에 먼저 자연스럽게 답해요.' });
  const all = intentId ? WM.thoughtsFor(intentId, secondaryId) : [], mine = all.filter(t => t.role === 'primary');
  const chosen = pick === 'first' || pick === 'second' ? mine.filter(t => t.rank === pick) : mine;
  if (chosen.length) parts.push({ kind: 'thought', thoughts: all, chosen: chosen.map(t => t.rank),
    text: pick === 'first' || pick === 'second' ? chosen[0].text : WM.thoughtLine(intentId), secondary: secondaryId ? WM.secondaryLine(intentId, secondaryId) : null,
    guide: '다음 문단에서 그 질문 밑의 기저 생각을 짚어요. 단정하지 않고 "~일 가능성이 높아요"로 말해요.' });
  const lead = chosen.find(t => t.root_id && t.mode !== 'guess') || mine.find(t => t.root_id && t.mode !== 'guess'), r = intentId ? WM.routeFor(intentId, caseData) : null;
  const th = intentId ? theoryFor({ rootId: lead?.root_id || null, sceneKey: r?.scene_key || null, intentId }, caseData) : null;
  if (th) parts.push({ kind: 'theory', ...th, root_id: lead?.root_id || null, guide: '그 기저 생각을 이 이론의 눈으로 쉽게 풀어 줘요. 이론 이름은 name 그대로 부르고, 어려운 말은 쓰지 않아요.' });
  if (intentId) { const roots = pick ? WM.thoughtPick(intentId, pick).score.map(x => x[0]) : WM.thoughtCandidates(intentId, secondaryId).map(x => x.root_id);
    parts.push({ kind: 'solution', roots, guess: all.filter(t => t.mode === 'guess').map(t => t.root_id), guide: '해결책을 바로 제안해요 — taskCandidates → useThoughtRoots(tc, roots) → pickTasks.' }); }
  return { mode: ref.related ? 'report' : 'plain', ref, parts };
}
