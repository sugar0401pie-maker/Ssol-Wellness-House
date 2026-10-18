# 쏘웰라 해석 DB v1.6 — 적용·검증·되돌리기

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
