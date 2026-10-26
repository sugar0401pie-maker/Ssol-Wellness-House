// CSO 선택지 카드 시험(choice_regression_v0.8.js 24개 + choice_paths_test_v0.8.js 모든 길)을 그대로 옮겨 node:test로 돌린다(2026-10-20).
// 데이터는 CSO 시험용 JSON 보관본(__fixtures__)이고, 운영 DB에서 만든 데이터와 같은지는 scripts/sw_cards_verify_live.mjs가 확인한다.
// CSO 코드를 거의 그대로 둔 것이라 lint 대상이 아니다(eslint.config.mjs의 cards 시험 예외).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as RS from '../interp/vendor/rootState.mjs';
import * as C from './vendor/choiceCards.mjs';

const DATA = JSON.parse(fs.readFileSync(new URL('./__fixtures__/choice_cards_fixture.json', import.meta.url), 'utf8'));
C.setData(DATA);

test('CSO 회귀 시험 RG-01~21', () => {
  C.CFG.requireShown = false; C.CFG.enabled = true;
const fails = []; const ok = (id, cond, msg) => { if (!cond) fails.push(id + ' ' + msg); };
  const ids = r => r.options.map(o => o.id);
  let st, s, r;
  // RG-01
  r = C.pickCardOptions('CC-GRP-1', {}); ok('RG-01', JSON.stringify(ids(r)) === JSON.stringify(['GO-1-PEOPLE','GO-1-COND','GO-1-PERF']) && r.fixed.length === 3, ids(r).join(','));
  // RG-02
  st = { 'ROOT-48': Object.assign(RS.newRootState('u','ROOT-48'), { score: 2 }) };
  r = C.pickCardOptions('CC-GRP-1', st); ok('RG-02', ids(r)[0] === 'GO-1-PERF' && r.options.some(o => o.kind !== '마음'), ids(r).join(','));
  // RG-03
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-1');
  const r0 = C.recordChoice(s, st, 'u', { optionId: 'GO-1-COND' }); r = C.recordChoice(s, st, 'u', { optionId: 'GO-2-COND-TODAY' }); ok('RG-03a', r0.type === 'card' && r0.card_id === 'CC-GRP-2-COND', '상태 보기라도 다음 카드가 있으면 이어감');
  ok('RG-03', r.type === 'stop' && r.label === '상태' && Object.keys(st).length === 0 && r.practice.avoid_tags.includes('노출 단계'), JSON.stringify(r));
  // RG-04
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-1');
  C.recordChoice(s, st, 'u', { optionId: 'GO-1-PERF' }); C.recordChoice(s, st, 'u', { optionId: 'GO-2-PERF-MINPYE' });
  r = C.recordChoice(s, st, 'u', { optionId: 'GO-3-MINPYE-REPUTE' });
  ok('RG-04a', r.type === 'confirm' && r.text.includes('낮게 볼'), r.text);
  r = C.confirmChoice(s, st, 'CF-2', 't');
  ok('RG-04b', st['ROOT-48'].score === 2 && st['ROOT-48'].status === 'confirmed' && st['ROOT-49'].score === 0 && !st['ROOT-17'] && st['ROOT-48'].generalized && st['ROOT-48'].confirm_scope.length === 1, `48=${st['ROOT-48'].score} 49=${st['ROOT-49'].score} — “민폐” 단어만으로 49 없음(조건부)`);
  // RG-05
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-1');
  ['GO-1-PERF','GO-2-PERF-MINPYE','GO-3-MINPYE-REPUTE'].forEach(id => C.recordChoice(s, st, 'u', { optionId: id }));
  r = C.confirmChoice(s, st, 'CF-3', 't'); ok('RG-05', st['ROOT-48'].score === 0 && st['ROOT-49'].score === 0 && r.type === 'stop', `48=${st['ROOT-48'].score} 49=${st['ROOT-49'].score}`);
  // RG-06
  s = C.newChoiceSession('c1', 'CC-GRP-1'); r = C.recordChoice(s, {}, 'u', { dk: true }); ok('RG-06', r.type === 'stop' && r.label === '모름', r.reason);
  // RG-07
  s = C.newChoiceSession('c1', 'CC-GRP-1'); C.recordChoice(s, {}, 'u', { optionId: 'GO-1-PERF' });
  r = C.recordChoice(s, {}, 'u', { dk: true }); const r2 = C.recordChoice(s, {}, 'u', { dk: true });
  ok('RG-07', r.type === 'card' && r2.type === 'stop', `${r.type}→${r2.type}`);
  // RG-08
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-3-MINPYE'); C.recordChoice(s, st, 'u', { optionId: 'GO-3-MINPYE-REPUTE' });
  s.cards_shown = 0; C.recordChoice(s, st, 'u', { optionId: 'GO-3-MINPYE-REPUTE' }); ok('RG-08', st['ROOT-48'].score === 1, `48=${st['ROOT-48'].score}`);
  // RG-09
  st = {}; s = C.newChoiceSession('c2', 'CC-GRP-3-REVEAL'); C.recordChoice(s, st, 'u', { optionId: 'GO-3-REVEAL-OTHERS' });
  const s3 = C.newChoiceSession('c3', 'CC-GRP-3-MINPYE'); C.recordChoice(s3, st, 'u', { optionId: 'GO-3-MINPYE-REPUTE' });
  ok('RG-09', st['ROOT-48'].score === 1, `같은 meaning_key grp:repute → 48=${st['ROOT-48'].score}`);
  // RG-10/11
  ok('RG-10', !ids(C.pickCardOptions('CC-GRP-2-COND', {}, {})).includes('GO-2-COND-BODY'), '건강 언급 없음 → BODY 숨김');
  const all = C.pickCardOptions('CC-GRP-2-COND', {}, { mentioned: ['health'], deniedOptions: ['GO-2-COND-TODAY','GO-2-COND-WORK'] });
  ok('RG-11', ids(all).includes('GO-2-COND-BODY'), ids(all).join(','));
  // RG-12
  st = { 'ROOT-48': Object.assign(RS.newRootState('u','ROOT-48'), { status: 'rejected' }) };
  ok('RG-12', !ids(C.pickCardOptions('CC-GRP-3-REVEAL', st)).includes('GO-3-REVEAL-OTHERS'), ids(C.pickCardOptions('CC-GRP-3-REVEAL', st)).join(','));
  // RG-13
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-1'); C.recordChoice(s, st, 'u', { optionId: 'GO-1-PEOPLE' });
  r = C.recordChoice(s, st, 'u', { optionId: 'GO-2-PEOPLE-ENERGY' });
  ok('RG-13a', r.type === 'confirm' && st['ROOT-11'].score === 0, `확인 전 11=${st['ROOT-11'].score}(조건부 대기)`);
  C.confirmChoice(s, st, 'CF-1', 't'); ok('RG-13b', st['ROOT-11'].score === 1, `확인 후 11=${st['ROOT-11'].score}`);
  // RG-14
  st = {}; s = C.newChoiceSession('c1', 'CC-GRP-1'); r = C.recordChoice(s, st, 'u', { multi: ['GO-1-PERF','GO-1-PEOPLE'] });
  ok('RG-14', r.type === 'card' && r.card_id === 'CC-GRP-2-PEOPLE' && s.pending_branch === 'GO-1-PERF', `${r.card_id} pending=${s.pending_branch}`);
  
  // RG-16 의미 부족(37 absent) → 점수 없음, 목표로만
  st = {}; s = C.newChoiceSession('c9', 'CC-WFT-1'); C.recordChoice(s, st, 'u', { optionId: 'CO-WFT-1-MEANING' });
  r = C.recordChoice(s, st, 'u', { optionId: 'CO-WFT-2-MEAN-REACH' });
  ok('RG-16a', st['ROOT-37'].score === 0 && st['ROOT-37'].goal.length === 1 && st['ROOT-37'].goal[0].polarity === 'absent', `37 score=${st['ROOT-37'].score} goal=${JSON.stringify(st['ROOT-37'].goal)}`);
  C.confirmChoice(s, st, 'CF-1', 't'); ok('RG-16b', st['ROOT-37'].status === 'candidate' && st['ROOT-37'].goal_confirmed, `status=${st['ROOT-37'].status} goal_confirmed=${st['ROOT-37'].goal_confirmed}`);
  // RG-17 정정(SIM-05): 47 확인 → “그냥 그날 창피했던 것” → 47 되돌림, 48로
  st = {}; s = C.newChoiceSession('c10', 'CC-MST-3-WORTH'); r = C.recordChoice(s, st, 'u', { optionId: 'CO-MST-3-WORTH-RESULT' });
  C.confirmChoice(s, st, 'CF-1', 't');
  const before = st['ROOT-47'].status;
  C.correctChoice(s, st, 'u', 'CO-MST-3-WORTH-RESULT', { optionId: 'CO-MST-3-WORTH-SEEN' });
  ok('RG-17', before === 'confirmed' && st['ROOT-47'].score === 0 && st['ROOT-47'].status === 'candidate' && st['ROOT-48'].score === 1, `47 ${before}→${st['ROOT-47'].status} score=${st['ROOT-47'].score} · 48=${st['ROOT-48'].score}`);
  // RG-18 중단 존중: 조건부 대기 점수 버림
  st = {}; s = C.newChoiceSession('c11', 'CC-GRP-1'); C.recordChoice(s, st, 'u', { optionId: 'GO-1-PERF' }); C.recordChoice(s, st, 'u', { optionId: 'GO-2-PERF-MINPYE' });
  r = C.recordChoice(s, st, 'u', { stop: true }); ok('RG-18', r.type === 'stop' && (st['ROOT-49']?.score || 0) === 0, `49=${st['ROOT-49']?.score}`);
  
  // RG-19 보여 주지 않은 보기는 거절(서버 검증)
  C.CFG.requireShown = true;
  st = {}; s = C.newChoiceSession('c12', 'CC-GRP-1'); const pc = C.presentCard(s, 'CC-GRP-1', {}, {});
  r = C.recordChoice(s, st, 'u', { optionId: 'GO-1-MUST' });          // 기본 3개에 없음
  const r19 = C.recordChoice(s, st, 'u', { optionId: pc.options[0].id });
  ok('RG-19', r.type === 'invalid_option' && r19.type === 'card', `${r.type} → ${r19.type}`);
  C.CFG.requireShown = false;
  // RG-20 기본 꺼짐
  C.CFG.enabled = false; ok('RG-20', C.presentCard(C.newChoiceSession('c13','CC-GRP-1'), 'CC-GRP-1').type === 'disabled', '스위치 꺼짐이면 카드 안 꺼냄'); C.CFG.enabled = true;
  // RG-21 장면이 달라도 같은 의미(claim)는 한 번만 — 의미 사전
  st = {}; s = C.newChoiceSession('c21', 'CC-GRP-3-MINPYE'); C.recordChoice(s, st, 'u', { optionId: 'GO-3-MINPYE-REPUTE' });
  const s21 = C.newChoiceSession('c21', 'CC-MST-3-WORTH'); C.recordChoice(s21, st, 'u', { optionId: 'CO-MST-3-WORTH-SEEN' });
  ok('RG-21', st['ROOT-48'].score === 1, `단체 운동 + 실수 장면 같은 claim C48-SEEN-LESS → 48=${st['ROOT-48'].score}`);
  
  C.CFG.requireShown = false; C.CFG.enabled = true;
  assert.deepEqual(fails, []);
});

test('CSO 모든 장면·모든 길 끝까지', () => {
  const D = C.getData(); C.CFG.requireShown = false; C.CFG.enabled = true;
  let paths = 0; const fails = [];
  const opts = cid => Object.values(D.options).filter(o => o.card === cid);
  for (const sc of D.scenes) {
    const first = C.pickCardOptions(sc.first_card, {});
    if (first.options.length !== 3) fails.push(`${sc.key} 1단 보기 ${first.options.length}`);
    if (!first.options.some(o => o.kind !== '마음')) fails.push(`${sc.key} 1단 비마음 없음`);
    if (first.options.some(o => o.gate)) fails.push(`${sc.key} 빈 상태에 🔸 보기 노출`);
    const walk = (cid, picks) => {
      for (const o of opts(cid)) {
        const st = {}, s = C.newChoiceSession('c', sc.first_card); let r;
        for (const id of [...picks, o.id]) r = C.recordChoice(s, st, 'u', { optionId: id });
        if (r.type === 'card') { walk(r.card_id, [...picks, o.id]); continue; }
        paths++;
        const chosen = new Set([...picks, o.id].flatMap(id => D.options[id].roots.map(x => x.root)));
        for (const k of Object.keys(st)) if (!chosen.has(k)) fails.push(`${sc.key} ${o.id} 고르지 않은 뿌리 ${k}`);
        if (s.cards_shown > 3) fails.push(`${sc.key} ${o.id} 카드 ${s.cards_shown}장`);
        if (r.type === 'confirm') { const c2 = C.confirmChoice(s, st, 'CF-2', 't'); if (c2.type !== 'stop') fails.push(`${o.id} 확인 뒤 멈춤 아님`); }
        else if (r.type !== 'stop') fails.push(`${o.id} 끝 상태 ${r.type}`);
        for (const [k, v] of Object.entries(st)) if (v.score > 3.01) fails.push(`${o.id} ${k} 점수 ${v.score}`);
      }
    };
    walk(sc.first_card, []);
  }
  assert.ok(paths > 300, '길 ' + paths);
  assert.deepEqual(fails, []);
});
