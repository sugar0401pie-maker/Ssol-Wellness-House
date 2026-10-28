# 쏘웰라 해석 DB — 적용·검증·되돌리기

> **2026-10-28: v4.5로 올립니다(CSO 개발 전달 묶음 v1.5 · 엔진 ESM v2.3). 아래 "v4.0 → v4.5 업그레이드"를 먼저 읽으세요.**

## v4.0 → v4.5 업그레이드 (CSO 개발 전달 묶음 v1.5)

| 파일 | 역할 |
| --- | --- |
| `apply_v4.5.sql` | **이것 하나만 실행.** CSO 10 → 20 → 30 → 40 → 우리 50(마지막) 순서. **v4.0이 올라간 DB 위에 그대로 실행**해도 새로 만든 v4.5와 차이 0건이고, 두 번 실행해도 안전하며, 빈 DB에 이것만 실행해도 같다는 것을 임시 데이터베이스(PGlite)에서 확인함. 11번(운영 표 연결 FK)은 v4.0과 내용이 같아 다시 실행하지 않는다. |

변경 요약: 새 표 4(`sw_ob_direction_axes`·`sw_ob_motive_positions`·`sw_ob_practice_flags`·`sw_ob_scene_domains`), 새 칸 `sw_ob_choice_options.gate`·`safety_hint` · `sw_ob_choice_scenes.confirm_place` · `sw_ob_root_texts.counter_1_root`·`counter_2_root` · `sw_ob_claims.direction`·`motive` · `sw_user_root_state.use_direction`·`use_direction_at`.

순서
1. (대표님) Supabase SQL Editor에서 `apply_v4.5.sql` 실행 → Success 확인.
2. (개발) 적재 `node --env-file=.env.local scripts/sw_load_reference.mjs --dir <v4.5 CSV 폴더> --sql supabase/sw_interp/apply_v4.5.sql --apply --force`
3. (개발) 새 CSV에서 빠진 예전 행 확인 `… --apply --prune-report` (삭제는 대표님 확인 뒤에만).
4. (개발) 검증 `node --env-file=.env.local scripts/sw_verify_live.mjs --dir <v4.5 CSV 폴더>` + 앱 e2e.
5. 코드 배포는 1~4가 끝난 뒤. (코드는 새 칸이 없는 DB에서도 죽지 않게 만들었지만, 새 기능은 SQL·CSV가 올라가야 켜진다.)

> **2026-10-27: v4.0으로 올립니다(CSO 개발 전달 묶음 v1.2 · 엔진 ESM v1.8). 아래 "v1.9 → v4.0 업그레이드"를 먼저 읽으세요.**

## v1.9 → v4.0 업그레이드 (CSO 개발 전달 묶음 v1.2)

| 파일 | 역할 |
| --- | --- |
| `apply_v4.0.sql` | **이것 하나만 실행.** CSO 10(참조표) → 20(사용자 상태) → 30(휴먼 세션) → 40(보관·삭제·집계) → 우리 50(가설 기록, 마지막) 순서로 이어 붙임. **v1.9가 올라간 DB 위에 그대로 실행**해도 새로 만든 v4.0과 표·칸·제약·함수가 같아지고(차이 0건), 두 번 실행해도 안전함을 임시 데이터베이스(PGlite)에서 확인함. v1.9 때와 달리 별도 업그레이드 파일이 필요 없다(CSO v4.0 파일들이 `add column if not exists`·제약 교체를 스스로 한다). |
| `11_…external_fk` (묶음 안) | 운영 표로 가는 연결(FK, NOT VALID). **지금은 실행하지 않는다.** 신규 이론 6개·신규 실천이 운영 표에 들어간 뒤 따로 실행하고 `validate constraint`. |

변경 요약: 새 표 3(`sw_ob_hyp_chat_links`·`sw_ob_practice_child_pairs`·`sw_ob_signal_review`) + `sw_stats_root_weekly`, 새 칸 약 10개(`hidden_at`×4·`merge_into`·`root_hold`·`root_link`×2·`audience`·`resolution`), 장부 `validity`에 `'hidden'` 추가, 함수 `sw_hide_user_records`·`sw_stats_refresh` 추가, **`sw_purge_inactive`는 인자가 `(int, boolean)` → `(int, int, boolean)`로 바뀜**(예전 모양은 파일 안에서 지우고 새로 만듦).

순서
1. (대표님) Supabase SQL Editor에서 `apply_v4.0.sql` 실행 → Success 확인.
2. (개발) CSV 비교 `node --env-file=.env.local scripts/sw_compare_reference.mjs <CSV 폴더> supabase/sw_interp/apply_v4.0.sql` — 읽기 전용.
3. (개발) 적재 `node --env-file=.env.local scripts/sw_load_reference.mjs --dir <CSV 폴더> --sql supabase/sw_interp/apply_v4.0.sql --apply --force`
4. (개발) 새 CSV에서 빠진 예전 행 확인 `… --apply --prune-report` → 확인 뒤 `… --apply --prune`. (업서트만으로는 CSO가 뺀 행이 DB에 남는다 — 예: 판별 문장 안 연결 69·뿌리 연결 9·claim 6.)
5. (개발) 검증 `node --env-file=.env.local scripts/sw_verify_live.mjs --dir <CSV 폴더>` + 앱 e2e.

주의
- **우리 50번은 반드시 마지막**: CSO 40번의 `sw_purge_user`는 우리 `sw_hypothesis_log`를 지우지 않아서, 우리 50번이 같은 함수를 덮어써 이 표 삭제를 더한다(v4.0의 CSO 함수와 한 줄만 다름을 확인함).
- 기록 삭제 요청 = "숨김(`sw_hide_user_records`)"은 우리 `sw_hypothesis_log`를 숨기지 않는다(칸이 없음) — 방침 결정(숨김 보관 vs 즉시 파기)이 나면 함께 정한다.
- 이전 버전으로 되돌리기: 이번 변경은 칸·표·함수 추가가 대부분이라 앱 코드를 이전 커밋으로 되돌려도 v1.9 코드와 호환된다(새 칸은 무시됨). 참조 데이터(CSV)를 덮어쓴 것은 적재 전에 `sw_compare_reference.mjs` 결과로 바뀐 행 수를 남겨 둔다.


> **2026-10-20: v1.9로 올립니다(아래 "v1.6 → v1.9 업그레이드" 먼저 읽기).** v1.6 설명은 처음 적용한 기록으로 남깁니다.

## v1.6 → v1.9 업그레이드 (CSO 패키지 v1.9)

| 파일 | 역할 |
| --- | --- |
| `apply_v1.9.sql` | **이것 하나만 실행.** 업그레이드(새 칸·기본키 변경) + CSO 10·20·30·40 + 우리 50(가설 기록)을 한 트랜잭션으로. v1.6이 이미 올라간 DB 위에 올린다(빈 DB도 가능). 중간에 오류가 나면 전부 취소. |
| `upgrade_v1.6_to_v1.9.sql` | 위 파일의 첫 부분(원본 보관). **CSO v1.9의 10번 파일은 이미 있는 표에 새 칸을 만들지 못해서 v1.6 위에 그대로 실행하면 실패한다**(`column "status" does not exist`) — 그래서 우리가 만든 부분. |
| `rollback_v1.9.sql` | 되돌리기(v1.6로 내리는 게 아니라 이 작업이 만든 sw_ 객체를 전부 지움 — 쌓인 데이터 포함). |

순서: ① Supabase SQL Editor에서 `apply_v1.9.sql` 실행 → ② `node scripts/sw_load_reference.mjs --dir <v1.9 CSV 폴더> --apply --force`(내용이 바뀐 표가 있어서 `--force`로 전부 덮어씀) → ③ `node scripts/sw_verify_live.mjs --dir <CSV 폴더>`.
**⚠ 주의**: CSO 40번 파일의 `sw_purge_user`는 우리 `sw_hypothesis_log`를 지우지 않는다. `apply_v1.9.sql`은 우리 50번을 마지막에 둬서 이를 고친다 — 순서를 바꾸지 말 것. 로컬(PGlite) 시험: v1.6→v1.9 2회 적용·기존 구간 행 유지·사용자 삭제가 가설 기록까지 지움·롤백 후 sw_ 객체 0개·빈 DB 적용 모두 통과.

# 쏘웰라 해석 DB v1.6 — 적용·검증·되돌리기(처음 적용 기록)

| 파일 | 역할 |
| --- | --- |
| `apply_v1.6.sql` | 새 `sw_` 표 64개·함수 8개·뷰 1개를 한 번에 만든다(한 트랜잭션: 중간에 실패하면 전부 취소). 기존 표·데이터는 바꾸지 않는다. |
| `50_sw_hypothesis_log_v1.sql` | 확률 방향용 판정 기록 표(위 파일에 이미 포함됨, 원본 보관용) |
| `rollback_v1.6.sql` | 되돌리기. 이 작업이 만든 `sw_` 객체만 지운다. 목록에 없는 `sw_` 객체가 있으면 아무것도 안 지우고 멈춘다. 쌓인 sw_ 데이터도 함께 지워진다. |
| `../../scripts/sw_load_reference.mjs` | 참조표 CSV 55개(27,513행)를 DB에 올린다. 기본은 검사만, `--apply`를 붙여야 올린다. |
| `../../scripts/sw_verify_live.mjs` | 적용 후 검증(임시 사용자 2명, 끝나면 삭제). 하나라도 실패하면 종료 코드 1. |

## 순서
1. Supabase 대시보드 → SQL Editor → New query → `apply_v1.6.sql` 전체 붙여넣기 → Run. (Success 확인. 오류가 나면 아무것도 만들어지지 않은 상태.)
2. `node scripts/sw_load_reference.mjs --dir <CSV 폴더> --apply`
3. `node scripts/sw_verify_live.mjs --dir <CSV 폴더>` → "모두 통과"면 끝, 실패가 있으면 `rollback_v1.6.sql` 실행.
4. `11_…external_fk`(운영 표로 가는 연결)는 신규 이론·실천이 운영에 들어간 뒤 따로 실행한다. 지금은 건너뛴다.

## 사전 검증(운영에 닿지 않음)
진짜 PostgreSQL(PGlite)에서 apply 2회 · CSV 적재 · 기능 · 접근 차단 · 삭제 · 롤백 안전장치 · 롤백 · 재적용을 시험해 34/34 통과(2026-10-18). 동시 접속(병렬 30건)과 Supabase 고유 동작은 3단계 검증이 운영에서 확인한다.

## 주의
- 이 표들은 서버 전용(RLS 켬 · 정책 없음)이고, 해석 엔진 스위치(`enableRootBoost`, 카드 `CFG.enabled`)는 꺼져 있어서 켜기 전까지 어떤 데이터도 쌓이지 않는다.
- 장부(`sw_evidence_events.meta.evidence`)에는 분류기가 사용자 말의 일부를 그대로 저장한다(대표 결정 2026-10-18). 동의 문구·처리방침에 명시해야 한다.
