// ─── 쏘웰라 저장소 보관본 · 원본: CSO 패키지 SSOL_해석엔진_ESM_v0.5/classifier/sw_claim_classifier_v0.2.js ───
// 수정은 PATCH-1 한 줄뿐(candidates가 ctx.scores를 받음). 원본이 새 버전으로 오면 이 파일을 새로 복사하고 PATCH-1만 다시 적용한다.
// 이 폴더는 외부 코드라 lint 대상이 아니다(eslint.config.mjs).
/**
 * 쏘웰라 발화 분류기 v0.2 (2026-10-18 · 검수 전 초안)
 * 사용자 말(자유 입력) → 의미 사전 claim(0~2개) → 엔진 사건(events)
 *
 * 처리 위치: lib/safety(위기 · 키워드) → 이론 탐색 제외 단어 → [이 분류기] → sw_apply_evidence
 *   - 위기 판단은 하지 않음. lib/safety가 걸렀으면 이 분류기를 부르지 않음(ctx.safetyHit = true면 바로 빈 결과)
 *   - 선택지 카드에서 보기를 누른 경우는 분류 불필요(ssol_choice_cards가 처리) — 분류는 ① 장면 감지 ② “다른 이유” 직접 입력 ③ 평소 대화의 자유 발화
 *
 * 모델 호출은 밖에서 주입: classify(text, ctx, callModel) — callModel({system, user}) → 모델 출력 문자열(JSON)
 * 순수 함수(저장 없음) · ESM. 원본 데이터는 DB(sw_ob_claims·sw_ob_claim_roots·sw_ob_choice_scenes) → setData()로만 넣음.
 * v0.2: 사건 형식을 엔진 장부 op와 같게(root_id·claim_id·source_type) · 0.5~0.7은 op 'candidate'(장부에 안 넣음) → ssol_root_state.applyChatClaims로 반영
 */
let CLAIMS = [];   // 운영: DB(sw_ob_claims·sw_ob_claim_roots)에서 읽어 setData — 시험: 시험 코드가 claims_v0.1.json을 읽어 넣음
let SCENES = [];   // sw_ob_choice_scenes
export const CFG = {
  topK: 24,              // 모델에게 보여 줄 후보 claim 수
  maxClaims: 2,          // 한 발화에서 고를 수 있는 claim 수
  scoreThreshold: 0.70,  // 이 이상이면 사건으로 기록(support는 점수)
  candidateThreshold: 0.50, // 0.50~0.70은 점수 없이 “후보”만 남김(확인 질문·카드로 확인)
  directPoints: 1.0,     // 근거 E등급 — 대화 판별 직접 연결 1.0
};
export function setData({ claims, scenes } = {}) { if (claims) CLAIMS = claims; if (scenes) SCENES = scenes; return true; }
const byId = () => Object.fromEntries(CLAIMS.map(c => [c.claim_id, c]));

// ── 후보 고르기(검색) — 기본은 글자 2-gram 유사도. 운영에서는 임베딩 검색으로 바꿔 끼우면 됨(같은 반환 형식)
function _grams(t) { const s = (t || '').replace(/[\s“”"'.,!?~…·()]/g, ''); const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; }
function _cos(a, b) { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; if (b.has(k)) d += v * b.get(k); } for (const v of b.values()) nb += v * v; return d && Math.sqrt(na * nb) ? d / Math.sqrt(na * nb) : 0; }
function _claimText(c, exclude) { return [c.label, ...c.examples, ...c.lean, ...c.core_thoughts].filter(x => x && x !== exclude); }
export function lexicalScores(text, opts = {}) {
  const g = _grams(text);
  return CLAIMS.map(c => ({ claim_id: c.claim_id, sim: Math.max(0, ..._claimText(c, opts.excludeText).map(t => _cos(g, _grams(t)))) }));
}
// 🔸 주제 키 — ctx.mentioned에 넣는 값: health · body_image · money · care · partner · job_change · family_expect · life_change
const TOPICS = [['health', /몸|부상|다친|건강/], ['body_image', /체중|몸매/], ['money', /비용|돈|형편/], ['care', /돌봄|집안/], ['partner', /연인/],
                ['job_change', /퇴사|이직|휴직|구직|쉼|일자리|평가/], ['family_expect', /가족/], ['life_change', /생활 변화/]];
function _topicOf(showIf) { return TOPICS.filter(([, re]) => re.test(showIf)).map(([k]) => k); }
export function candidates(text, ctx = {}) {
  let pool = CLAIMS.filter(c => !c.generic);                                                              // 세부 claim만 검색 — 뿌리 대표 claim은 항상 목록으로
  if (ctx.scene) pool = CLAIMS.filter(c => c.scenes.includes(ctx.scene) || c.kind.includes('상태'));        // 장면을 알면 그 장면 claim + 상태
  const mentioned = new Set(ctx.mentioned || []);
  pool = pool.filter(c => !c.show_if || _topicOf(c.show_if).some(t => mentioned.has(t)));               // 🔸 claim은 본인이 그 주제를 먼저 말했을 때만
  const ids = new Set(pool.map(c => c.claim_id));
  const sc = (ctx.scores || lexicalScores(text, ctx)).filter(x => ids.has(x.claim_id)).sort((a, b) => b.sim - a.sim);   // PATCH-1(쏘웰라): ctx.scores = 임베딩 검색 점수 [{claim_id, sim}]를 주면 글자 유사도 대신 씀
  return sc.slice(0, ctx.topK || CFG.topK).map(x => ({ ...byId()[x.claim_id], sim: x.sim }));
}

// ── 프롬프트
export const SYSTEM = `너는 쏠 웰니스 하우스 쏘웰라의 "발화 의미 분류기"다. 상담 답변을 쓰지 않는다. 사용자의 말 한 번을 읽고, 아래 후보 목록에서 그 말에 담긴 의미(claim)를 0~2개 고른다.

규칙
1. 사용자가 **자기 자신의 경험·마음**을 말한 경우만 고른다. 다른 사람 이야기, 인용("친구가 ~래요"), 가정("만약 ~라면"), 질문만 있는 말, 과거에 그랬지만 지금은 아니라는 말은 표시만 하고 고르지 않는다.
2. 부정·정정("그건 아니고", "~때문은 아니에요")이 붙은 의미는 고르지 않는다. 앞 답을 고치는 말이면 corrects에 적는다.
3. 단어가 같다고 고르지 않는다. 의미가 같을 때만 고른다. "민폐"라는 단어만으로 '책임을 떠안음'을 고르지 않는다 — 이유(평판·미안함·관계)가 드러나야 한다.
4. 컨디션·취향·여건(시간·돈·규칙 모름·실제 불이익)이면 그 claim을 고른다. 마음의 문제로 바꿔 읽지 않는다.
5. 세부 의미(B 목록)가 맞으면 그것을 고른다. 세부 의미에 맞는 게 없고 뿌리 설명(A 목록)이 분명히 맞을 때만 R- 뿌리를 고른다. 자원 성격 뿌리(예: 일에서 의미를 느낌·함께하는 시간이 행복)는 그 자원이 "있다"는 말일 때만 고른다 — "없다·찾고 싶다"는 B 목록의 부족·바람 claim이나 none.
6. 확신이 없으면 고르지 않는다(none). 억지로 가장 비슷한 것을 고르지 않는다. 후보에 맞는 게 없으면 other_reason에 사용자 말 그대로 요약한다.
7. 진단·병명·성격 유형을 붙이지 않는다. 위기 판단은 하지 않는다(이미 앞 단계에서 걸렀다).
8. 사라지고 싶다·죽고 싶다·자해·절망 확신·심한 일상 무너짐처럼 위기로 보이는 말이면 claim을 고르지 않고 safety_suspect를 true로 둔다(판단은 앞 단계 lib/safety가 함 — 여기서는 점수를 만들지 않기만 한다).
9. confidence는 0~1. 0.7 이상은 "그 의미가 분명하다", 0.5~0.7은 "그럴 수 있지만 확인이 필요하다".

출력은 JSON 하나만:
{"claims":[{"claim_id":"...","evidence":"사용자 말에서 근거가 된 부분(그대로)","actor":"self|other","temporal":"now|past|habitual","negated":false,"hypothetical":false,"confidence":0.0}],
 "scene_key":"장면 키 또는 null","corrects":"앞 답을 고치는 말이면 고친 내용, 아니면 null","other_reason":"후보에 없을 때 요약, 아니면 null","safety_suspect":false,"none":true|false}`;

function rootList(ctx = {}) {                                                                               // A 목록: 뿌리 대표 claim(항상) — 운영 이론 선택처럼 한 줄 설명
  const mentioned = new Set(ctx.mentioned || []);
  return CLAIMS.filter(c => c.generic && (!c.show_if || mentioned.size)).map(c => `- ${c.claim_id} | ${c.label}${c.counter.length ? ` | 헷갈림: ${c.counter[0]}` : ''}`).join('\n');
}
export function buildPrompt(text, ctx = {}, cands = candidates(text, ctx)) {
  const list = cands.map(c => `- ${c.claim_id} | ${c.label}${c.kind && !c.kind.includes('마음') ? ` (${c.kind})` : ''} | 예: ${[...c.examples.slice(0, 2), ...c.lean.slice(0, 1)].map(x => `"${x}"`).join(' / ')}${c.counter.length ? ` | 아님: "${c.counter[0]}"` : ''}`).join('\n');
  const sceneList = (SCENES || []).map(s => `- ${s.key}: ${s.name} — ${String(s.open_when).replace(/\([^)]*[A-Z]{2,}-[^)]*\)/g, '').trim()}`).join('\n');   // 내부 노드 id는 빼고
  const user = [
    ctx.lastBot ? `쏘웰라의 직전 말: "${ctx.lastBot}"` : null,
    ctx.scene ? `지금 장면: ${ctx.scene}` : `장면 후보(사용자 말이 이 장면을 처음 꺼내면 scene_key에 적기):\n${sceneList}`,
    `A. 뿌리 목록(세부 의미가 없을 때만):\n${rootList(ctx)}`,
    `B. 세부 의미 후보(먼저 볼 것):\n${list}`,
    `사용자 말: "${text}"`,
  ].filter(Boolean).join('\n\n');
  return { system: SYSTEM, user, candidate_ids: [...cands.map(c => c.claim_id), ...CLAIMS.filter(c => c.generic).map(c => c.claim_id)] };
}

// ── 모델 출력 검사 · 정리
export function validate(raw, cands = []) {
  let o; try { o = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim()) : raw; } catch (e) { return { ok: false, error: 'json_parse', claims: [], none: true }; }
  const allowed = new Set([...cands.map(c => c.claim_id), ...CLAIMS.filter(c => c.generic).map(c => c.claim_id)]); const C = byId(); const drop = [];
  const claims = (o.claims || []).filter(x => {
    if (!C[x.claim_id]) { drop.push([x.claim_id, 'unknown_id']); return false; }
    if (allowed.size && !allowed.has(x.claim_id)) { drop.push([x.claim_id, 'not_in_candidates']); return false; }
    if (x.actor && x.actor !== 'self') { drop.push([x.claim_id, 'other_actor']); return false; }
    if (x.negated || x.hypothetical) { drop.push([x.claim_id, 'negated_or_hypothetical']); return false; }
    if (x.temporal === 'past') { drop.push([x.claim_id, 'past_only']); return false; }
    return typeof x.confidence === 'number' && x.confidence >= CFG.candidateThreshold;
  }).sort((a, b) => b.confidence - a.confidence).slice(0, CFG.maxClaims);
  if (o.safety_suspect) return { ok: true, claims: [], scene_key: null, safety_suspect: true, none: true, dropped: drop };   // 위기로 보이면 점수 없음 — 판단은 lib/safety
  const scene = (SCENES || []).some(s => s.key === o.scene_key) ? o.scene_key : null;
  return { ok: true, claims, scene_key: scene, corrects: o.corrects || null, other_reason: o.other_reason || null, none: !claims.length, dropped: drop };
}

// ── 엔진 사건으로(서버가 sw_apply_evidence에 넘김) — 근거 E등급: support 1.0 · conditional 0(확인 대기) · goal 0(목표)
export function toEvents(result, ctx = {}) {
  const C = byId(), ev = [];
  for (const x of result.claims || []) {
    const c = C[x.claim_id];
    for (const r of c.roots) {
      const sure = x.confidence >= CFG.scoreThreshold;
      const pts = (r.link === 'support' && sure) ? (c.generic ? c.points : CFG.directPoints) : 0;   // 뿌리 대표 claim은 0.5(근거 E · 노드 거침)
      ev.push({ op: sure ? 'apply' : 'candidate', event_id: `${ctx.messageId || 'msg'}:${x.claim_id}:${r.root}`, root_id: r.root, source_type: 'chat', points: pts,
                link: r.link, polarity: r.polarity, claim_id: x.claim_id, chat_id: ctx.chatId || null, message_id: ctx.messageId || null,
                evidence: x.evidence, confidence: x.confidence });
    }
  }
  return ev;   // → applyChatClaims(states, userId, events, sink): 같은 의미 한 번만(CR-10) · candidate는 hints로
}

/** 한 번에: 후보 → 프롬프트 → 모델 → 검사 → 사건 */
export async function classify(text, ctx = {}, callModel) {
  if (ctx.safetyHit) return { skipped: 'safety', claims: [], events: [] };
  const cands = candidates(text, ctx);
  const prompt = buildPrompt(text, ctx, cands);
  const raw = await callModel({ system: prompt.system, user: prompt.user });
  const res = validate(raw, cands);
  return { ...res, events: res.ok ? toEvents(res, ctx) : [], candidates: prompt.candidate_ids };
}

