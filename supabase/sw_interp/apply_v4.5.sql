-- 쏘웰라 해석 DB v4.5 적용 파일 (2026-10-28 CSO 개발 전달 묶음 v1.5)
-- 순서: CSO 10(참조표) → 20(사용자 상태) → 30(휴먼 세션) → 40(보관·삭제·집계) → 우리 50(가설 기록, 반드시 마지막: CSO 40번의 sw_purge_user는 sw_hypothesis_log를 지우지 않아 우리 50번이 함수를 덮어써 고친다).
-- v4.0이 올라간 DB 위에 그대로 실행해도 새로 만든 v4.5와 같아지고, 두 번 실행해도 안전함을 임시 데이터베이스에서 확인함. 11번(운영 표 연결 FK)은 따로 실행하지 않는다(v4.0 때 apply_v4.0_fk.sql로 이미 처리).

-- ===== CSO 10_sw_reference_tables_v4.5.sql =====
-- 쏘웰라(sw) 해석 DB v4.5 · 10 참조표(sw_ob_*) — 해석 트리·뿌리·카드·규칙
-- 서버 전용(RLS 켬, 정책 없음 = anon·authenticated 접근 불가, service_role만)
-- 재실행 안전: CREATE TABLE IF NOT EXISTS · 제약은 이름 붙여 없을 때만 추가
begin;

-- 온보딩 문항 메타(층위·해석 무게)
create table if not exists public.sw_ob_questions (
  question_id text not null,
  title text,
  layer text,
  layer_desc text,
  behavior_weight numeric,
  rank_weights text,
  cue_base numeric,
  cue_rank_factors text,
  constraint sw_ob_questions_pkey primary key (question_id)
);
alter table public.sw_ob_questions enable row level security;
revoke all on public.sw_ob_questions from anon, authenticated;
grant all on public.sw_ob_questions to service_role;

alter table public.sw_ob_questions add column if not exists title text;
alter table public.sw_ob_questions add column if not exists layer text;
alter table public.sw_ob_questions add column if not exists layer_desc text;
alter table public.sw_ob_questions add column if not exists behavior_weight numeric;
alter table public.sw_ob_questions add column if not exists rank_weights text;
alter table public.sw_ob_questions add column if not exists cue_base numeric;
alter table public.sw_ob_questions add column if not exists cue_rank_factors text;
-- 보기와 5축 점수
create table if not exists public.sw_ob_options (
  question_id text not null,
  option_key text not null,
  label text,
  meaning text,
  nov integer,
  soc integer,
  mov integer,
  gro integer,
  shr integer,
  cue_multiplier text,
  status text,
  parent_key text,
  constraint sw_ob_options_pkey primary key (question_id, option_key)
);
alter table public.sw_ob_options enable row level security;
revoke all on public.sw_ob_options from anon, authenticated;
grant all on public.sw_ob_options to service_role;

alter table public.sw_ob_options add column if not exists label text;
alter table public.sw_ob_options add column if not exists meaning text;
alter table public.sw_ob_options add column if not exists nov integer;
alter table public.sw_ob_options add column if not exists soc integer;
alter table public.sw_ob_options add column if not exists mov integer;
alter table public.sw_ob_options add column if not exists gro integer;
alter table public.sw_ob_options add column if not exists shr integer;
alter table public.sw_ob_options add column if not exists cue_multiplier text;
alter table public.sw_ob_options add column if not exists status text;
alter table public.sw_ob_options add column if not exists parent_key text;
-- 공통 뿌리(근본 원인) — 점수·확인·거절의 단위
create table if not exists public.sw_ob_roots (
  root_id text not null,
  name text,
  nature_primary text,
  nature_secondary text,
  mechanism text,
  opposite_root_id text,
  parent_root_id text,
  safety_note text,
  constraint sw_ob_roots_pkey primary key (root_id)
);
alter table public.sw_ob_roots enable row level security;
revoke all on public.sw_ob_roots from anon, authenticated;
grant all on public.sw_ob_roots to service_role;

alter table public.sw_ob_roots add column if not exists name text;
alter table public.sw_ob_roots add column if not exists nature_primary text;
alter table public.sw_ob_roots add column if not exists nature_secondary text;
alter table public.sw_ob_roots add column if not exists mechanism text;
alter table public.sw_ob_roots add column if not exists opposite_root_id text;
alter table public.sw_ob_roots add column if not exists parent_root_id text;
alter table public.sw_ob_roots add column if not exists safety_note text;
-- 뿌리 ↔ 이론 개념
create table if not exists public.sw_ob_root_concepts (
  root_id text not null,
  concept_id text not null,
  ord integer,
  constraint sw_ob_root_concepts_pkey primary key (root_id, concept_id)
);
alter table public.sw_ob_root_concepts enable row level security;
revoke all on public.sw_ob_root_concepts from anon, authenticated;
grant all on public.sw_ob_root_concepts to service_role;

alter table public.sw_ob_root_concepts add column if not exists ord integer;
-- 장면(대화에서 드러나는 세부 행동)
create table if not exists public.sw_ob_scenes (
  scene_id text not null,
  question_id text,
  option_key text,
  scene text,
  example_utterance text,
  opening_question text,
  constraint sw_ob_scenes_pkey primary key (scene_id)
);
alter table public.sw_ob_scenes enable row level security;
revoke all on public.sw_ob_scenes from anon, authenticated;
grant all on public.sw_ob_scenes to service_role;

alter table public.sw_ob_scenes add column if not exists question_id text;
alter table public.sw_ob_scenes add column if not exists option_key text;
alter table public.sw_ob_scenes add column if not exists scene text;
alter table public.sw_ob_scenes add column if not exists example_utterance text;
alter table public.sw_ob_scenes add column if not exists opening_question text;
-- 가설(경쟁 해석)
create table if not exists public.sw_ob_hypotheses (
  hyp_id text not null,
  question_id text,
  option_key text,
  text text,
  nature text,
  rationale text,
  onboarding_signals text,
  generalize_check text,
  caution text,
  root_id text,
  cue_weight numeric,
  cue_basis text,
  cond_json jsonb,
  cond_chat_cues jsonb,
  cond_unknown jsonb,
  cond_note text,
  constraint sw_ob_hypotheses_pkey primary key (hyp_id)
);
alter table public.sw_ob_hypotheses enable row level security;
revoke all on public.sw_ob_hypotheses from anon, authenticated;
grant all on public.sw_ob_hypotheses to service_role;

alter table public.sw_ob_hypotheses add column if not exists question_id text;
alter table public.sw_ob_hypotheses add column if not exists option_key text;
alter table public.sw_ob_hypotheses add column if not exists text text;
alter table public.sw_ob_hypotheses add column if not exists nature text;
alter table public.sw_ob_hypotheses add column if not exists rationale text;
alter table public.sw_ob_hypotheses add column if not exists onboarding_signals text;
alter table public.sw_ob_hypotheses add column if not exists generalize_check text;
alter table public.sw_ob_hypotheses add column if not exists caution text;
alter table public.sw_ob_hypotheses add column if not exists root_id text;
alter table public.sw_ob_hypotheses add column if not exists cue_weight numeric;
alter table public.sw_ob_hypotheses add column if not exists cue_basis text;
alter table public.sw_ob_hypotheses add column if not exists cond_json jsonb;
alter table public.sw_ob_hypotheses add column if not exists cond_chat_cues jsonb;
alter table public.sw_ob_hypotheses add column if not exists cond_unknown jsonb;
alter table public.sw_ob_hypotheses add column if not exists cond_note text;
-- 하위 동기
create table if not exists public.sw_ob_submotives (
  sub_id text not null,
  hyp_id text,
  text text,
  rationale text,
  lean_utterance text,
  counter_utterance text,
  practice_text text,
  caution text,
  root_id text,
  root_same_as_parent boolean,
  root_reason text,
  root_hold boolean,
  root_link text,
  constraint sw_ob_submotives_pkey primary key (sub_id)
);
alter table public.sw_ob_submotives enable row level security;
revoke all on public.sw_ob_submotives from anon, authenticated;
grant all on public.sw_ob_submotives to service_role;

alter table public.sw_ob_submotives add column if not exists hyp_id text;
alter table public.sw_ob_submotives add column if not exists text text;
alter table public.sw_ob_submotives add column if not exists rationale text;
alter table public.sw_ob_submotives add column if not exists lean_utterance text;
alter table public.sw_ob_submotives add column if not exists counter_utterance text;
alter table public.sw_ob_submotives add column if not exists practice_text text;
alter table public.sw_ob_submotives add column if not exists caution text;
alter table public.sw_ob_submotives add column if not exists root_id text;
alter table public.sw_ob_submotives add column if not exists root_same_as_parent boolean;
alter table public.sw_ob_submotives add column if not exists root_reason text;
alter table public.sw_ob_submotives add column if not exists root_hold boolean;
alter table public.sw_ob_submotives add column if not exists root_link text;
-- 세부 갈래(작동 방식)
create table if not exists public.sw_ob_leaves (
  leaf_id text not null,
  sub_id text,
  text text,
  mechanism text,
  lean_utterance text,
  counter_utterance text,
  practice_text text,
  next_theory text,
  caution text,
  root_id text,
  root_same_as_parent boolean,
  root_reason text,
  human_session boolean,
  human_phrase_group text,
  root_hold boolean,
  root_link text,
  constraint sw_ob_leaves_pkey primary key (leaf_id)
);
alter table public.sw_ob_leaves enable row level security;
revoke all on public.sw_ob_leaves from anon, authenticated;
grant all on public.sw_ob_leaves to service_role;

alter table public.sw_ob_leaves add column if not exists sub_id text;
alter table public.sw_ob_leaves add column if not exists text text;
alter table public.sw_ob_leaves add column if not exists mechanism text;
alter table public.sw_ob_leaves add column if not exists lean_utterance text;
alter table public.sw_ob_leaves add column if not exists counter_utterance text;
alter table public.sw_ob_leaves add column if not exists practice_text text;
alter table public.sw_ob_leaves add column if not exists next_theory text;
alter table public.sw_ob_leaves add column if not exists caution text;
alter table public.sw_ob_leaves add column if not exists root_id text;
alter table public.sw_ob_leaves add column if not exists root_same_as_parent boolean;
alter table public.sw_ob_leaves add column if not exists root_reason text;
alter table public.sw_ob_leaves add column if not exists human_session boolean;
alter table public.sw_ob_leaves add column if not exists human_phrase_group text;
alter table public.sw_ob_leaves add column if not exists root_hold boolean;
alter table public.sw_ob_leaves add column if not exists root_link text;
-- 더 쪼개지 않은 하위 동기와 이유
create table if not exists public.sw_ob_no_split (
  sub_id text not null,
  reason text,
  constraint sw_ob_no_split_pkey primary key (sub_id)
);
alter table public.sw_ob_no_split enable row level security;
revoke all on public.sw_ob_no_split from anon, authenticated;
grant all on public.sw_ob_no_split to service_role;

alter table public.sw_ob_no_split add column if not exists reason text;
-- 장면 ↔ 가설
create table if not exists public.sw_ob_scene_links (
  scene_id text not null,
  hyp_id text not null,
  relevance text,
  reason text,
  constraint sw_ob_scene_links_pkey primary key (scene_id, hyp_id)
);
alter table public.sw_ob_scene_links enable row level security;
revoke all on public.sw_ob_scene_links from anon, authenticated;
grant all on public.sw_ob_scene_links to service_role;

alter table public.sw_ob_scene_links add column if not exists relevance text;
alter table public.sw_ob_scene_links add column if not exists reason text;
-- 질문 사다리 1~5단계
create table if not exists public.sw_ob_ladder_questions (
  q_id text not null,
  question_id text,
  option_key text,
  target_type text,
  target_id text,
  step integer,
  purpose text,
  question_text text,
  options_text text,
  branch_text text,
  constraint sw_ob_ladder_questions_pkey primary key (q_id)
);
alter table public.sw_ob_ladder_questions enable row level security;
revoke all on public.sw_ob_ladder_questions from anon, authenticated;
grant all on public.sw_ob_ladder_questions to service_role;

alter table public.sw_ob_ladder_questions add column if not exists question_id text;
alter table public.sw_ob_ladder_questions add column if not exists option_key text;
alter table public.sw_ob_ladder_questions add column if not exists target_type text;
alter table public.sw_ob_ladder_questions add column if not exists target_id text;
alter table public.sw_ob_ladder_questions add column if not exists step integer;
alter table public.sw_ob_ladder_questions add column if not exists purpose text;
alter table public.sw_ob_ladder_questions add column if not exists question_text text;
alter table public.sw_ob_ladder_questions add column if not exists options_text text;
alter table public.sw_ob_ladder_questions add column if not exists branch_text text;
-- 가설·하위 동기·갈래 ↔ 이론 개념
create table if not exists public.sw_ob_node_concepts (
  node_type text not null,
  node_id text not null,
  concept_id text not null,
  ord integer,
  constraint sw_ob_node_concepts_pkey primary key (node_type, node_id, concept_id)
);
alter table public.sw_ob_node_concepts enable row level security;
revoke all on public.sw_ob_node_concepts from anon, authenticated;
grant all on public.sw_ob_node_concepts to service_role;

alter table public.sw_ob_node_concepts add column if not exists ord integer;
-- 안전·민감 표시
create table if not exists public.sw_ob_node_marks (
  node_type text not null,
  node_id text not null,
  mark text not null,
  text text,
  constraint sw_ob_node_marks_pkey primary key (node_type, node_id, mark)
);
alter table public.sw_ob_node_marks enable row level security;
revoke all on public.sw_ob_node_marks from anon, authenticated;
grant all on public.sw_ob_node_marks to service_role;

alter table public.sw_ob_node_marks add column if not exists text text;
-- 동기 위치 4단계(제1장 1-3-4 자기결정이론) — 표시 기준·말·실천 방향
create table if not exists public.sw_ob_motive_positions (
  position text not null,
  ord integer,
  label text,
  meaning text,
  user_phrase text,
  rogers text,
  practice_hint text,
  constraint sw_ob_motive_positions_pkey primary key (position)
);
alter table public.sw_ob_motive_positions enable row level security;
revoke all on public.sw_ob_motive_positions from anon, authenticated;
grant all on public.sw_ob_motive_positions to service_role;

alter table public.sw_ob_motive_positions add column if not exists ord integer;
alter table public.sw_ob_motive_positions add column if not exists label text;
alter table public.sw_ob_motive_positions add column if not exists meaning text;
alter table public.sw_ob_motive_positions add column if not exists user_phrase text;
alter table public.sw_ob_motive_positions add column if not exists rogers text;
alter table public.sw_ob_motive_positions add column if not exists practice_hint text;
-- 카드 장면 → 영역(동기 위치 기록용 MV-01)
create table if not exists public.sw_ob_scene_domains (
  scene_key text not null,
  domain text,
  constraint sw_ob_scene_domains_pkey primary key (scene_key)
);
alter table public.sw_ob_scene_domains enable row level security;
revoke all on public.sw_ob_scene_domains from anon, authenticated;
grant all on public.sw_ob_scene_domains to service_role;

alter table public.sw_ob_scene_domains add column if not exists domain text;
-- 성장 방향 축 4개(제1장 1-2-3 · CSO 10-27 G1) — sw_user_signals growth.<축>에 기록·리포트 문장
create table if not exists public.sw_ob_direction_axes (
  axis text not null,
  slot text,
  label text,
  ch1_question text,
  report_more text,
  report_first text,
  note text,
  constraint sw_ob_direction_axes_pkey primary key (axis)
);
alter table public.sw_ob_direction_axes enable row level security;
revoke all on public.sw_ob_direction_axes from anon, authenticated;
grant all on public.sw_ob_direction_axes to service_role;

alter table public.sw_ob_direction_axes add column if not exists slot text;
alter table public.sw_ob_direction_axes add column if not exists label text;
alter table public.sw_ob_direction_axes add column if not exists ch1_question text;
alter table public.sw_ob_direction_axes add column if not exists report_more text;
alter table public.sw_ob_direction_axes add column if not exists report_first text;
alter table public.sw_ob_direction_axes add column if not exists note text;
-- 실천 표시(제1장 반영 · CSO 10-27) — beyond_self: 나를 넘어서는 실천(RC-19) · courage_why: 새 제안 이유(RC-20) · path/path2: 즐거움·몰입·의미 주·부 갈래(RC-21) · motive_fit: 동기 위치에 맞는 실천(MV-03)
create table if not exists public.sw_ob_practice_flags (
  practice_id text not null,
  flag text not null,
  value text,
  note text,
  constraint sw_ob_practice_flags_pkey primary key (practice_id, flag)
);
alter table public.sw_ob_practice_flags enable row level security;
revoke all on public.sw_ob_practice_flags from anon, authenticated;
grant all on public.sw_ob_practice_flags to service_role;

alter table public.sw_ob_practice_flags add column if not exists value text;
alter table public.sw_ob_practice_flags add column if not exists note text;
-- 문항을 넘나드는 조합 규칙
create table if not exists public.sw_ob_combos (
  combo_id text not null,
  source text,
  name text,
  cond_json jsonb,
  boost_json jsonb,
  roots text,
  entry_hyps text,
  theory text,
  modifier text,
  sensitive text,
  merge_into text,
  constraint sw_ob_combos_pkey primary key (combo_id)
);
alter table public.sw_ob_combos enable row level security;
revoke all on public.sw_ob_combos from anon, authenticated;
grant all on public.sw_ob_combos to service_role;

alter table public.sw_ob_combos add column if not exists source text;
alter table public.sw_ob_combos add column if not exists name text;
alter table public.sw_ob_combos add column if not exists cond_json jsonb;
alter table public.sw_ob_combos add column if not exists boost_json jsonb;
alter table public.sw_ob_combos add column if not exists roots text;
alter table public.sw_ob_combos add column if not exists entry_hyps text;
alter table public.sw_ob_combos add column if not exists theory text;
alter table public.sw_ob_combos add column if not exists modifier text;
alter table public.sw_ob_combos add column if not exists sensitive text;
alter table public.sw_ob_combos add column if not exists merge_into text;
-- 뿌리 없는 판별 문장(기법·개념용) — 검토 대기
create table if not exists public.sw_ob_signal_unrooted (
  signal_id text not null,
  reason text,
  constraint sw_ob_signal_unrooted_pkey primary key (signal_id)
);
alter table public.sw_ob_signal_unrooted enable row level security;
revoke all on public.sw_ob_signal_unrooted from anon, authenticated;
grant all on public.sw_ob_signal_unrooted to service_role;

alter table public.sw_ob_signal_unrooted add column if not exists reason text;
-- 심리테스트 점수 구간(반열린 구간 lo ≤ 점수 < hi · VH만 hi 포함)
create table if not exists public.sw_ob_test_bands (
  instrument text not null,
  band text not null,
  lo numeric,
  hi numeric,
  hi_inclusive boolean,
  label text,
  constraint sw_ob_test_bands_pkey primary key (instrument, band)
);
alter table public.sw_ob_test_bands enable row level security;
revoke all on public.sw_ob_test_bands from anon, authenticated;
grant all on public.sw_ob_test_bands to service_role;

alter table public.sw_ob_test_bands add column if not exists lo numeric;
alter table public.sw_ob_test_bands add column if not exists hi numeric;
alter table public.sw_ob_test_bands add column if not exists hi_inclusive boolean;
alter table public.sw_ob_test_bands add column if not exists label text;
-- 채팅 판별 문장 → 공통 뿌리(대화 근거 E등급 가산용)
create table if not exists public.sw_ob_signal_roots (
  signal_id text not null,
  root_id text not null,
  via text not null,
  weight numeric,
  constraint sw_ob_signal_roots_pkey primary key (signal_id, root_id, via)
);
alter table public.sw_ob_signal_roots enable row level security;
revoke all on public.sw_ob_signal_roots from anon, authenticated;
grant all on public.sw_ob_signal_roots to service_role;

alter table public.sw_ob_signal_roots add column if not exists weight numeric;
-- 뿌리에 가산하면 안 되는 실천(회피 강화 등) — 가산 대신 -2
create table if not exists public.sw_ob_root_practice_avoid (
  root_id text not null,
  practice_id text not null,
  reason text,
  constraint sw_ob_root_practice_avoid_pkey primary key (root_id, practice_id)
);
alter table public.sw_ob_root_practice_avoid enable row level security;
revoke all on public.sw_ob_root_practice_avoid from anon, authenticated;
grant all on public.sw_ob_root_practice_avoid to service_role;

alter table public.sw_ob_root_practice_avoid add column if not exists reason text;
-- 프로필별 뿌리당 걸러진 뒤 남는 실천 수(얇은 뿌리 확인용)
create table if not exists public.sw_ob_root_practice_coverage (
  root_id text not null,
  profile text not null,
  eligible integer,
  constraint sw_ob_root_practice_coverage_pkey primary key (root_id, profile)
);
alter table public.sw_ob_root_practice_coverage enable row level security;
revoke all on public.sw_ob_root_practice_coverage from anon, authenticated;
grant all on public.sw_ob_root_practice_coverage to service_role;

alter table public.sw_ob_root_practice_coverage add column if not exists eligible integer;
-- 상황 문항(연애·육아·주 활동·하루 시간·제외 활동) — 해석 트리 없음
create table if not exists public.sw_ob_ctx_questions (
  question_id text not null,
  label text,
  select_type text,
  ask_when text,
  sensitive text,
  code_status text,
  constraint sw_ob_ctx_questions_pkey primary key (question_id)
);
alter table public.sw_ob_ctx_questions enable row level security;
revoke all on public.sw_ob_ctx_questions from anon, authenticated;
grant all on public.sw_ob_ctx_questions to service_role;

alter table public.sw_ob_ctx_questions add column if not exists label text;
alter table public.sw_ob_ctx_questions add column if not exists select_type text;
alter table public.sw_ob_ctx_questions add column if not exists ask_when text;
alter table public.sw_ob_ctx_questions add column if not exists sensitive text;
alter table public.sw_ob_ctx_questions add column if not exists code_status text;
-- 상황 문항 보기별 거르기·조정·말하기 규칙
create table if not exists public.sw_ob_ctx_options (
  question_id text not null,
  option_key text not null,
  label text,
  sensitive text,
  practice_filter jsonb,
  practice_adjust jsonb,
  theory_rules jsonb,
  domain_weight jsonb,
  talk_rule text,
  two_branch_text text,
  combo_ids text,
  constraint sw_ob_ctx_options_pkey primary key (question_id, option_key)
);
alter table public.sw_ob_ctx_options enable row level security;
revoke all on public.sw_ob_ctx_options from anon, authenticated;
grant all on public.sw_ob_ctx_options to service_role;

alter table public.sw_ob_ctx_options add column if not exists label text;
alter table public.sw_ob_ctx_options add column if not exists sensitive text;
alter table public.sw_ob_ctx_options add column if not exists practice_filter jsonb;
alter table public.sw_ob_ctx_options add column if not exists practice_adjust jsonb;
alter table public.sw_ob_ctx_options add column if not exists theory_rules jsonb;
alter table public.sw_ob_ctx_options add column if not exists domain_weight jsonb;
alter table public.sw_ob_ctx_options add column if not exists talk_rule text;
alter table public.sw_ob_ctx_options add column if not exists two_branch_text text;
alter table public.sw_ob_ctx_options add column if not exists combo_ids text;
-- 대화에서 상황이 바뀌는 신호 → 갱신 규칙(최신 정보 우선)
create table if not exists public.sw_ob_ctx_updates (
  update_id text not null,
  question_id text,
  chat_signal text,
  new_value text,
  sensitive text,
  condition text,
  after text,
  safety_link text,
  constraint sw_ob_ctx_updates_pkey primary key (update_id)
);
alter table public.sw_ob_ctx_updates enable row level security;
revoke all on public.sw_ob_ctx_updates from anon, authenticated;
grant all on public.sw_ob_ctx_updates to service_role;

alter table public.sw_ob_ctx_updates add column if not exists question_id text;
alter table public.sw_ob_ctx_updates add column if not exists chat_signal text;
alter table public.sw_ob_ctx_updates add column if not exists new_value text;
alter table public.sw_ob_ctx_updates add column if not exists sensitive text;
alter table public.sw_ob_ctx_updates add column if not exists condition text;
alter table public.sw_ob_ctx_updates add column if not exists after text;
alter table public.sw_ob_ctx_updates add column if not exists safety_link text;
-- 상황 문항 해석·말하기 금지 규칙
create table if not exists public.sw_ob_ctx_guards (
  guard_id text not null,
  target text,
  dont text,
  instead text,
  constraint sw_ob_ctx_guards_pkey primary key (guard_id)
);
alter table public.sw_ob_ctx_guards enable row level security;
revoke all on public.sw_ob_ctx_guards from anon, authenticated;
grant all on public.sw_ob_ctx_guards to service_role;

alter table public.sw_ob_ctx_guards add column if not exists target text;
alter table public.sw_ob_ctx_guards add column if not exists dont text;
alter table public.sw_ob_ctx_guards add column if not exists instead text;
-- 상황이 뿌리 해석은 그대로 두고 질문·실천만 조정
create table if not exists public.sw_ob_ctx_root_modifiers (
  mod_id text not null,
  condition text,
  root_id text,
  adjust text,
  constraint sw_ob_ctx_root_modifiers_pkey primary key (mod_id)
);
alter table public.sw_ob_ctx_root_modifiers enable row level security;
revoke all on public.sw_ob_ctx_root_modifiers from anon, authenticated;
grant all on public.sw_ob_ctx_root_modifiers to service_role;

alter table public.sw_ob_ctx_root_modifiers add column if not exists condition text;
alter table public.sw_ob_ctx_root_modifiers add column if not exists root_id text;
alter table public.sw_ob_ctx_root_modifiers add column if not exists adjust text;
-- 세분화 검수에서 "다른 뿌리 쪽"으로 표시된 노드(전문위원 확인용)
create table if not exists public.sw_ob_root_review_flags (
  root_id text,
  node_id text not null,
  note text,
  resolution text,
  constraint sw_ob_root_review_flags_pkey primary key (node_id)
);
alter table public.sw_ob_root_review_flags enable row level security;
revoke all on public.sw_ob_root_review_flags from anon, authenticated;
grant all on public.sw_ob_root_review_flags to service_role;

alter table public.sw_ob_root_review_flags add column if not exists root_id text;
alter table public.sw_ob_root_review_flags add column if not exists note text;
alter table public.sw_ob_root_review_flags add column if not exists resolution text;
-- 심리테스트 → 공통 뿌리 단서(근거 D등급, 재검사 시 대체)
create table if not exists public.sw_ob_test_root_cues (
  instrument text,
  cue_id text not null,
  source text,
  cond_json jsonb,
  root_id text,
  points numeric,
  direction text,
  entry_hyps text,
  why text,
  guard text,
  spec_status text,
  polarity text,
  note text,
  constraint sw_ob_test_root_cues_pkey primary key (cue_id)
);
alter table public.sw_ob_test_root_cues enable row level security;
revoke all on public.sw_ob_test_root_cues from anon, authenticated;
grant all on public.sw_ob_test_root_cues to service_role;

alter table public.sw_ob_test_root_cues add column if not exists instrument text;
alter table public.sw_ob_test_root_cues add column if not exists source text;
alter table public.sw_ob_test_root_cues add column if not exists cond_json jsonb;
alter table public.sw_ob_test_root_cues add column if not exists root_id text;
alter table public.sw_ob_test_root_cues add column if not exists points numeric;
alter table public.sw_ob_test_root_cues add column if not exists direction text;
alter table public.sw_ob_test_root_cues add column if not exists entry_hyps text;
alter table public.sw_ob_test_root_cues add column if not exists why text;
alter table public.sw_ob_test_root_cues add column if not exists guard text;
alter table public.sw_ob_test_root_cues add column if not exists spec_status text;
alter table public.sw_ob_test_root_cues add column if not exists polarity text;
alter table public.sw_ob_test_root_cues add column if not exists note text;
-- 뿌리 → 탐색 이론 우선순위(1~3순위)
create table if not exists public.sw_ob_root_theory (
  root_id text not null,
  rank integer,
  theory_id text not null,
  score numeric,
  basis_concepts text,
  status text,
  gate text,
  note text,
  constraint sw_ob_root_theory_pkey primary key (root_id, theory_id)
);
alter table public.sw_ob_root_theory enable row level security;
revoke all on public.sw_ob_root_theory from anon, authenticated;
grant all on public.sw_ob_root_theory to service_role;

alter table public.sw_ob_root_theory add column if not exists rank integer;
alter table public.sw_ob_root_theory add column if not exists score numeric;
alter table public.sw_ob_root_theory add column if not exists basis_concepts text;
alter table public.sw_ob_root_theory add column if not exists status text;
alter table public.sw_ob_root_theory add column if not exists gate text;
alter table public.sw_ob_root_theory add column if not exists note text;
-- 뿌리 사용자 문장(채팅 반영·확인 질문·반대 확인·리포트) — 단정 금지
create table if not exists public.sw_ob_root_texts (
  root_id text not null,
  reflect_1 text,
  reflect_2 text,
  reflect_3 text,
  check_q_1 text,
  check_q_2 text,
  counter_1 text,
  counter_2 text,
  counter_1_root text,
  counter_2_root text,
  report text,
  strength text,
  avoid_words text,
  sensitive boolean,
  constraint sw_ob_root_texts_pkey primary key (root_id)
);
alter table public.sw_ob_root_texts enable row level security;
revoke all on public.sw_ob_root_texts from anon, authenticated;
grant all on public.sw_ob_root_texts to service_role;

alter table public.sw_ob_root_texts add column if not exists reflect_1 text;
alter table public.sw_ob_root_texts add column if not exists reflect_2 text;
alter table public.sw_ob_root_texts add column if not exists reflect_3 text;
alter table public.sw_ob_root_texts add column if not exists check_q_1 text;
alter table public.sw_ob_root_texts add column if not exists check_q_2 text;
alter table public.sw_ob_root_texts add column if not exists counter_1 text;
alter table public.sw_ob_root_texts add column if not exists counter_2 text;
alter table public.sw_ob_root_texts add column if not exists counter_1_root text;
alter table public.sw_ob_root_texts add column if not exists counter_2_root text;
alter table public.sw_ob_root_texts add column if not exists report text;
alter table public.sw_ob_root_texts add column if not exists strength text;
alter table public.sw_ob_root_texts add column if not exists avoid_words text;
alter table public.sw_ob_root_texts add column if not exists sensitive boolean;
-- 휴먼 세션 기록 양식 칸(상담사 화면)
create table if not exists public.sw_ob_hs_fields (
  field_id text not null,
  table_name text,
  column_name text,
  label text,
  input text,
  choices text,
  required text,
  note text,
  constraint sw_ob_hs_fields_pkey primary key (field_id)
);
alter table public.sw_ob_hs_fields enable row level security;
revoke all on public.sw_ob_hs_fields from anon, authenticated;
grant all on public.sw_ob_hs_fields to service_role;

alter table public.sw_ob_hs_fields add column if not exists table_name text;
alter table public.sw_ob_hs_fields add column if not exists column_name text;
alter table public.sw_ob_hs_fields add column if not exists label text;
alter table public.sw_ob_hs_fields add column if not exists input text;
alter table public.sw_ob_hs_fields add column if not exists choices text;
alter table public.sw_ob_hs_fields add column if not exists required text;
alter table public.sw_ob_hs_fields add column if not exists note text;
-- 휴먼 세션 사전 브리핑 구성(AI → 상담사)
create table if not exists public.sw_ob_hs_prebrief (
  item_id text not null,
  title text,
  content text,
  constraint sw_ob_hs_prebrief_pkey primary key (item_id)
);
alter table public.sw_ob_hs_prebrief enable row level security;
revoke all on public.sw_ob_hs_prebrief from anon, authenticated;
grant all on public.sw_ob_hs_prebrief to service_role;

alter table public.sw_ob_hs_prebrief add column if not exists title text;
alter table public.sw_ob_hs_prebrief add column if not exists content text;
-- 뿌리별 검증 대화 세트(정답 포함) — 판별 회귀 테스트용
create table if not exists public.sw_ob_eval_set (
  eval_id text not null,
  root_id text,
  kind text,
  utterance text,
  context text,
  expected text,
  why text,
  constraint sw_ob_eval_set_pkey primary key (eval_id)
);
alter table public.sw_ob_eval_set enable row level security;
revoke all on public.sw_ob_eval_set from anon, authenticated;
grant all on public.sw_ob_eval_set to service_role;

alter table public.sw_ob_eval_set add column if not exists root_id text;
alter table public.sw_ob_eval_set add column if not exists kind text;
alter table public.sw_ob_eval_set add column if not exists utterance text;
alter table public.sw_ob_eval_set add column if not exists context text;
alter table public.sw_ob_eval_set add column if not exists expected text;
alter table public.sw_ob_eval_set add column if not exists why text;
-- 헷갈리는 뿌리 묶음 가르기(판별 질문 1개)
create table if not exists public.sw_ob_root_discriminators (
  group_id text not null,
  roots text,
  axis text,
  ask text,
  options_json jsonb,
  cues_json jsonb,
  default_root text,
  both_ok text,
  constraint sw_ob_root_discriminators_pkey primary key (group_id)
);
alter table public.sw_ob_root_discriminators enable row level security;
revoke all on public.sw_ob_root_discriminators from anon, authenticated;
grant all on public.sw_ob_root_discriminators to service_role;

alter table public.sw_ob_root_discriminators add column if not exists roots text;
alter table public.sw_ob_root_discriminators add column if not exists axis text;
alter table public.sw_ob_root_discriminators add column if not exists ask text;
alter table public.sw_ob_root_discriminators add column if not exists options_json jsonb;
alter table public.sw_ob_root_discriminators add column if not exists cues_json jsonb;
alter table public.sw_ob_root_discriminators add column if not exists default_root text;
alter table public.sw_ob_root_discriminators add column if not exists both_ok text;
-- 근거 등급 표(A~F, 아스트로 자리 포함)
create table if not exists public.sw_ob_evidence_grades (
  grade text not null,
  source text,
  points text,
  constraint sw_ob_evidence_grades_pkey primary key (grade)
);
alter table public.sw_ob_evidence_grades enable row level security;
revoke all on public.sw_ob_evidence_grades from anon, authenticated;
grant all on public.sw_ob_evidence_grades to service_role;

alter table public.sw_ob_evidence_grades add column if not exists source text;
alter table public.sw_ob_evidence_grades add column if not exists points text;
-- 아스트로 리포트 성향 진술 → 공통 뿌리(근거 F+, 유형 직접 선택 시 D)
create table if not exists public.sw_ob_astro_statements (
  unit_id text not null,
  lookup_key text,
  src text,
  field text,
  ctx text,
  report_text text,
  chat_quote text,
  check_q text,
  roots_json jsonb,
  note text,
  constraint sw_ob_astro_statements_pkey primary key (unit_id)
);
alter table public.sw_ob_astro_statements enable row level security;
revoke all on public.sw_ob_astro_statements from anon, authenticated;
grant all on public.sw_ob_astro_statements to service_role;

alter table public.sw_ob_astro_statements add column if not exists lookup_key text;
alter table public.sw_ob_astro_statements add column if not exists src text;
alter table public.sw_ob_astro_statements add column if not exists field text;
alter table public.sw_ob_astro_statements add column if not exists ctx text;
alter table public.sw_ob_astro_statements add column if not exists report_text text;
alter table public.sw_ob_astro_statements add column if not exists chat_quote text;
alter table public.sw_ob_astro_statements add column if not exists check_q text;
alter table public.sw_ob_astro_statements add column if not exists roots_json jsonb;
alter table public.sw_ob_astro_statements add column if not exists note text;
-- 쏘웰라 첫 인사(점성술 말 없는 버전)
create table if not exists public.sw_ob_astro_greetings (
  greet_id text not null,
  when_used text,
  text text,
  constraint sw_ob_astro_greetings_pkey primary key (greet_id)
);
alter table public.sw_ob_astro_greetings enable row level security;
revoke all on public.sw_ob_astro_greetings from anon, authenticated;
grant all on public.sw_ob_astro_greetings to service_role;

alter table public.sw_ob_astro_greetings add column if not exists when_used text;
alter table public.sw_ob_astro_greetings add column if not exists text text;
-- 채팅 출력 검사 — 점성술 전용 말(정규식)
create table if not exists public.sw_ob_astro_terms (
  pattern text not null,
  constraint sw_ob_astro_terms_pkey primary key (pattern)
);
alter table public.sw_ob_astro_terms enable row level security;
revoke all on public.sw_ob_astro_terms from anon, authenticated;
grant all on public.sw_ob_astro_terms to service_role;

-- 상황 문항 답별 이론·실천 필터 규칙
create table if not exists public.sw_ob_context_rules (
  question_id text not null,
  answer text not null,
  use text,
  note text,
  constraint sw_ob_context_rules_pkey primary key (question_id, answer)
);
alter table public.sw_ob_context_rules enable row level security;
revoke all on public.sw_ob_context_rules from anon, authenticated;
grant all on public.sw_ob_context_rules to service_role;

alter table public.sw_ob_context_rules add column if not exists use text;
alter table public.sw_ob_context_rules add column if not exists note text;
-- 상황 문항 활용표
create table if not exists public.sw_ob_context_use (
  question_id text not null,
  label text,
  usage text,
  guardrail text,
  constraint sw_ob_context_use_pkey primary key (question_id)
);
alter table public.sw_ob_context_use enable row level security;
revoke all on public.sw_ob_context_use from anon, authenticated;
grant all on public.sw_ob_context_use to service_role;

alter table public.sw_ob_context_use add column if not exists label text;
alter table public.sw_ob_context_use add column if not exists usage text;
alter table public.sw_ob_context_use add column if not exists guardrail text;
-- 휴먼 세션 권유 문구
create table if not exists public.sw_ob_human_phrases (
  phrase_id text not null,
  grp text,
  text text,
  constraint sw_ob_human_phrases_pkey primary key (phrase_id)
);
alter table public.sw_ob_human_phrases enable row level security;
revoke all on public.sw_ob_human_phrases from anon, authenticated;
grant all on public.sw_ob_human_phrases to service_role;

alter table public.sw_ob_human_phrases add column if not exists grp text;
alter table public.sw_ob_human_phrases add column if not exists text text;
-- 운영 규칙(사다리·뿌리·조합·휴먼·③)
create table if not exists public.sw_ob_rules (
  rule_id text not null,
  area text not null,
  name text,
  content text,
  constraint sw_ob_rules_pkey primary key (rule_id, area)
);
alter table public.sw_ob_rules enable row level security;
revoke all on public.sw_ob_rules from anon, authenticated;
grant all on public.sw_ob_rules to service_role;

alter table public.sw_ob_rules add column if not exists name text;
alter table public.sw_ob_rules add column if not exists content text;
-- ② 바로 안전 규칙 신호
create table if not exists public.sw_ob_safety_signals (
  signal_id text not null,
  grp text,
  signal text,
  example text,
  level text,
  db_rule text,
  constraint sw_ob_safety_signals_pkey primary key (signal_id)
);
alter table public.sw_ob_safety_signals enable row level security;
revoke all on public.sw_ob_safety_signals from anon, authenticated;
grant all on public.sw_ob_safety_signals to service_role;

alter table public.sw_ob_safety_signals add column if not exists grp text;
alter table public.sw_ob_safety_signals add column if not exists signal text;
alter table public.sw_ob_safety_signals add column if not exists example text;
alter table public.sw_ob_safety_signals add column if not exists level text;
alter table public.sw_ob_safety_signals add column if not exists db_rule text;
-- ③ 깊어짐 신호
create table if not exists public.sw_ob_escalate_signals (
  signal_id text not null,
  name text,
  example text,
  constraint sw_ob_escalate_signals_pkey primary key (signal_id)
);
alter table public.sw_ob_escalate_signals enable row level security;
revoke all on public.sw_ob_escalate_signals from anon, authenticated;
grant all on public.sw_ob_escalate_signals to service_role;

alter table public.sw_ob_escalate_signals add column if not exists name text;
alter table public.sw_ob_escalate_signals add column if not exists example text;
-- 뿌리 ↔ 실천(wellness_practices)
create table if not exists public.sw_ob_root_practices (
  root_id text not null,
  practice_id text not null,
  source text,
  audience text,
  constraint sw_ob_root_practices_pkey primary key (root_id, practice_id)
);
alter table public.sw_ob_root_practices enable row level security;
revoke all on public.sw_ob_root_practices from anon, authenticated;
grant all on public.sw_ob_root_practices to service_role;

alter table public.sw_ob_root_practices add column if not exists source text;
alter table public.sw_ob_root_practices add column if not exists audience text;
-- v2.5 온보딩 가설의 대화 조각(cond_chat_cues) → 대화에서 확인할 대상(OB-16)
create table if not exists public.sw_ob_hyp_chat_links (
  hyp_id text not null,
  cue text not null,
  link_type text not null,
  target text not null,
  match text,
  note text,
  constraint sw_ob_hyp_chat_links_pkey primary key (hyp_id, cue, link_type, target)
);
alter table public.sw_ob_hyp_chat_links enable row level security;
revoke all on public.sw_ob_hyp_chat_links from anon, authenticated;
grant all on public.sw_ob_hyp_chat_links to service_role;

alter table public.sw_ob_hyp_chat_links add column if not exists match text;
alter table public.sw_ob_hyp_chat_links add column if not exists note text;
-- v2.2 아이 전제 실천 ↔ 같은 뜻의 아이 없는 버전(뿌리별) — 아이 없는 사용자에게는 짝 실천을 씀
create table if not exists public.sw_ob_practice_child_pairs (
  root_id text not null,
  child_practice_id text not null,
  alt_practice_id text not null,
  alt_kind text,
  note text,
  constraint sw_ob_practice_child_pairs_pkey primary key (root_id, child_practice_id, alt_practice_id)
);
alter table public.sw_ob_practice_child_pairs enable row level security;
revoke all on public.sw_ob_practice_child_pairs from anon, authenticated;
grant all on public.sw_ob_practice_child_pairs to service_role;

alter table public.sw_ob_practice_child_pairs add column if not exists alt_kind text;
alter table public.sw_ob_practice_child_pairs add column if not exists note text;
-- 선택지 카드(쏘웰라가 이유 보기 3개를 보여 주고 고르게 함)
create table if not exists public.sw_ob_choice_cards (
  card_id text not null,
  module text,
  level integer,
  open_when text,
  lead_text text,
  parent_option_id text,
  show_n integer,
  card_style text,
  constraint sw_ob_choice_cards_pkey primary key (card_id)
);
alter table public.sw_ob_choice_cards enable row level security;
revoke all on public.sw_ob_choice_cards from anon, authenticated;
grant all on public.sw_ob_choice_cards to service_role;

alter table public.sw_ob_choice_cards add column if not exists module text;
alter table public.sw_ob_choice_cards add column if not exists level integer;
alter table public.sw_ob_choice_cards add column if not exists open_when text;
alter table public.sw_ob_choice_cards add column if not exists lead_text text;
alter table public.sw_ob_choice_cards add column if not exists parent_option_id text;
alter table public.sw_ob_choice_cards add column if not exists show_n integer;
alter table public.sw_ob_choice_cards add column if not exists card_style text;
-- 모든 카드에 붙는 고정 보기
create table if not exists public.sw_ob_choice_cards_fixed (
  fixed_id text not null,
  text text,
  effect text,
  constraint sw_ob_choice_cards_fixed_pkey primary key (fixed_id)
);
alter table public.sw_ob_choice_cards_fixed enable row level security;
revoke all on public.sw_ob_choice_cards_fixed from anon, authenticated;
grant all on public.sw_ob_choice_cards_fixed to service_role;

alter table public.sw_ob_choice_cards_fixed add column if not exists text text;
alter table public.sw_ob_choice_cards_fixed add column if not exists effect text;
-- 의미 사전 — 장면이 달라도 같은 의미는 claim 하나(발화 분류의 라벨)
create table if not exists public.sw_ob_claims (
  claim_id text not null,
  label text,
  kind text,
  scenes text,
  examples_json jsonb,
  lean_json jsonb,
  counter_json jsonb,
  core_thoughts_json jsonb,
  show_if text,
  generic boolean,
  points numeric,
  signal_ids text,
  direction text,
  motive text,
  constraint sw_ob_claims_pkey primary key (claim_id)
);
alter table public.sw_ob_claims enable row level security;
revoke all on public.sw_ob_claims from anon, authenticated;
grant all on public.sw_ob_claims to service_role;

alter table public.sw_ob_claims add column if not exists label text;
alter table public.sw_ob_claims add column if not exists kind text;
alter table public.sw_ob_claims add column if not exists scenes text;
alter table public.sw_ob_claims add column if not exists examples_json jsonb;
alter table public.sw_ob_claims add column if not exists lean_json jsonb;
alter table public.sw_ob_claims add column if not exists counter_json jsonb;
alter table public.sw_ob_claims add column if not exists core_thoughts_json jsonb;
alter table public.sw_ob_claims add column if not exists show_if text;
alter table public.sw_ob_claims add column if not exists generic boolean;
alter table public.sw_ob_claims add column if not exists points numeric;
alter table public.sw_ob_claims add column if not exists signal_ids text;
alter table public.sw_ob_claims add column if not exists direction text;
alter table public.sw_ob_claims add column if not exists motive text;
-- claim → 뿌리(연결 종류·방향 — 뿌리 연결은 여기만이 원본)
create table if not exists public.sw_ob_claim_roots (
  claim_id text not null,
  root_id text not null,
  link text,
  polarity text,
  cond text,
  constraint sw_ob_claim_roots_pkey primary key (claim_id, root_id)
);
alter table public.sw_ob_claim_roots enable row level security;
revoke all on public.sw_ob_claim_roots from anon, authenticated;
grant all on public.sw_ob_claim_roots to service_role;

alter table public.sw_ob_claim_roots add column if not exists link text;
alter table public.sw_ob_claim_roots add column if not exists polarity text;
alter table public.sw_ob_claim_roots add column if not exists cond text;
-- 카드 보기(후보군 — 개인화로 3개만 노출)
create table if not exists public.sw_ob_choice_options (
  option_id text not null,
  card_id text,
  text text,
  kind text,
  node_id text,
  roots_json jsonb,
  rank_roots text,
  base_rank integer,
  show_if text,
  gate text,
  safety_hint boolean,
  next_card_id text,
  core_thought text,
  lean_utterance text,
  counter_utterance text,
  practice_json jsonb,
  note text,
  meaning_key text,
  claim_id text,
  constraint sw_ob_choice_options_pkey primary key (option_id)
);
alter table public.sw_ob_choice_options enable row level security;
revoke all on public.sw_ob_choice_options from anon, authenticated;
grant all on public.sw_ob_choice_options to service_role;

alter table public.sw_ob_choice_options add column if not exists card_id text;
alter table public.sw_ob_choice_options add column if not exists text text;
alter table public.sw_ob_choice_options add column if not exists kind text;
alter table public.sw_ob_choice_options add column if not exists node_id text;
alter table public.sw_ob_choice_options add column if not exists roots_json jsonb;
alter table public.sw_ob_choice_options add column if not exists rank_roots text;
alter table public.sw_ob_choice_options add column if not exists base_rank integer;
alter table public.sw_ob_choice_options add column if not exists show_if text;
alter table public.sw_ob_choice_options add column if not exists gate text;
alter table public.sw_ob_choice_options add column if not exists safety_hint boolean;
alter table public.sw_ob_choice_options add column if not exists next_card_id text;
alter table public.sw_ob_choice_options add column if not exists core_thought text;
alter table public.sw_ob_choice_options add column if not exists lean_utterance text;
alter table public.sw_ob_choice_options add column if not exists counter_utterance text;
alter table public.sw_ob_choice_options add column if not exists practice_json jsonb;
alter table public.sw_ob_choice_options add column if not exists note text;
alter table public.sw_ob_choice_options add column if not exists meaning_key text;
alter table public.sw_ob_choice_options add column if not exists claim_id text;
-- 확인 카드(확인 + 영역 일반화)
create table if not exists public.sw_ob_choice_confirm (
  confirm_id text not null,
  template text,
  text text,
  effect text,
  constraint sw_ob_choice_confirm_pkey primary key (confirm_id)
);
alter table public.sw_ob_choice_confirm enable row level security;
revoke all on public.sw_ob_choice_confirm from anon, authenticated;
grant all on public.sw_ob_choice_confirm to service_role;

alter table public.sw_ob_choice_confirm add column if not exists template text;
alter table public.sw_ob_choice_confirm add column if not exists text text;
alter table public.sw_ob_choice_confirm add column if not exists effect text;
-- 선택지 카드 장면 묶음(대표 장면)
create table if not exists public.sw_ob_choice_scenes (
  scene_key text not null,
  name text,
  module text,
  first_card_id text,
  open_when text,
  confirm_place text,
  constraint sw_ob_choice_scenes_pkey primary key (scene_key)
);
alter table public.sw_ob_choice_scenes enable row level security;
revoke all on public.sw_ob_choice_scenes from anon, authenticated;
grant all on public.sw_ob_choice_scenes to service_role;

alter table public.sw_ob_choice_scenes add column if not exists name text;
alter table public.sw_ob_choice_scenes add column if not exists module text;
alter table public.sw_ob_choice_scenes add column if not exists first_card_id text;
alter table public.sw_ob_choice_scenes add column if not exists open_when text;
alter table public.sw_ob_choice_scenes add column if not exists confirm_place text;
-- 선택지 카드 회귀 사례
create table if not exists public.sw_ob_choice_regression (
  scene_key text not null,
  case_id text not null,
  state text,
  utterance text,
  path text,
  expected text,
  constraint sw_ob_choice_regression_pkey primary key (scene_key, case_id)
);
alter table public.sw_ob_choice_regression enable row level security;
revoke all on public.sw_ob_choice_regression from anon, authenticated;
grant all on public.sw_ob_choice_regression to service_role;

alter table public.sw_ob_choice_regression add column if not exists state text;
alter table public.sw_ob_choice_regression add column if not exists utterance text;
alter table public.sw_ob_choice_regression add column if not exists path text;
alter table public.sw_ob_choice_regression add column if not exists expected text;
-- 카드 보기 → 실천 후보 id(통합 검토 7단계 · 검수 전 · 자동 노출 금지)
create table if not exists public.sw_ob_choice_practice_candidates (
  option_id text not null,
  practice_id text not null,
  title text,
  root_id text not null,
  relation text,
  review_status text,
  auto_expose boolean,
  constraint sw_ob_choice_practice_candidates_pkey primary key (option_id, practice_id, root_id)
);
alter table public.sw_ob_choice_practice_candidates enable row level security;
revoke all on public.sw_ob_choice_practice_candidates from anon, authenticated;
grant all on public.sw_ob_choice_practice_candidates to service_role;

alter table public.sw_ob_choice_practice_candidates add column if not exists title text;
alter table public.sw_ob_choice_practice_candidates add column if not exists relation text;
alter table public.sw_ob_choice_practice_candidates add column if not exists review_status text;
alter table public.sw_ob_choice_practice_candidates add column if not exists auto_expose boolean;
-- 노드 방향(자원 뿌리의 부족·바람)
create table if not exists public.sw_ob_node_polarity (
  node_id text not null,
  root_id text,
  polarity text,
  rule text,
  constraint sw_ob_node_polarity_pkey primary key (node_id)
);
alter table public.sw_ob_node_polarity enable row level security;
revoke all on public.sw_ob_node_polarity from anon, authenticated;
grant all on public.sw_ob_node_polarity to service_role;

alter table public.sw_ob_node_polarity add column if not exists root_id text;
alter table public.sw_ob_node_polarity add column if not exists polarity text;
alter table public.sw_ob_node_polarity add column if not exists rule text;
-- 신규 이론 6개 판별 문장 183 — 뿌리 의미 검수 기록(v3.1~)
create table if not exists public.sw_ob_signal_review (
  signal_id text not null,
  theory_id text,
  utterance text,
  kind text,
  roots text,
  note text,
  batch text,
  status text,
  constraint sw_ob_signal_review_pkey primary key (signal_id)
);
alter table public.sw_ob_signal_review enable row level security;
revoke all on public.sw_ob_signal_review from anon, authenticated;
grant all on public.sw_ob_signal_review to service_role;

alter table public.sw_ob_signal_review add column if not exists theory_id text;
alter table public.sw_ob_signal_review add column if not exists utterance text;
alter table public.sw_ob_signal_review add column if not exists kind text;
alter table public.sw_ob_signal_review add column if not exists roots text;
alter table public.sw_ob_signal_review add column if not exists note text;
alter table public.sw_ob_signal_review add column if not exists batch text;
alter table public.sw_ob_signal_review add column if not exists status text;
-- 대화 판별 문장 초안(공백 뿌리 29·37·51·86 — 운영 미반영)
create table if not exists public.sw_ob_signal_drafts (
  signal_id text not null,
  root_id text,
  utterance text,
  theory_id text,
  concept_id text,
  hypothesis_ids text,
  required_evidence text,
  confirmation_question text,
  counterexamples_json jsonb,
  competing_root_ids text,
  runtime_weight numeric,
  production_enabled boolean,
  status text,
  constraint sw_ob_signal_drafts_pkey primary key (signal_id)
);
alter table public.sw_ob_signal_drafts enable row level security;
revoke all on public.sw_ob_signal_drafts from anon, authenticated;
grant all on public.sw_ob_signal_drafts to service_role;

alter table public.sw_ob_signal_drafts add column if not exists root_id text;
alter table public.sw_ob_signal_drafts add column if not exists utterance text;
alter table public.sw_ob_signal_drafts add column if not exists theory_id text;
alter table public.sw_ob_signal_drafts add column if not exists concept_id text;
alter table public.sw_ob_signal_drafts add column if not exists hypothesis_ids text;
alter table public.sw_ob_signal_drafts add column if not exists required_evidence text;
alter table public.sw_ob_signal_drafts add column if not exists confirmation_question text;
alter table public.sw_ob_signal_drafts add column if not exists counterexamples_json jsonb;
alter table public.sw_ob_signal_drafts add column if not exists competing_root_ids text;
alter table public.sw_ob_signal_drafts add column if not exists runtime_weight numeric;
alter table public.sw_ob_signal_drafts add column if not exists production_enabled boolean;
alter table public.sw_ob_signal_drafts add column if not exists status text;
-- 기존 노드 수정 기록
create table if not exists public.sw_ob_node_fixes (
  row_id bigint generated always as identity,
  node_id text,
  field text,
  change text,
  reason text,
  constraint sw_ob_node_fixes_pkey primary key (row_id)
);
alter table public.sw_ob_node_fixes enable row level security;
revoke all on public.sw_ob_node_fixes from anon, authenticated;
grant all on public.sw_ob_node_fixes to service_role;

alter table public.sw_ob_node_fixes add column if not exists node_id text;
alter table public.sw_ob_node_fixes add column if not exists field text;
alter table public.sw_ob_node_fixes add column if not exists change text;
alter table public.sw_ob_node_fixes add column if not exists reason text;
-- 심리테스트 주 고민 영역 → 요인(유형 단서의 "영역 안 가장 낮은 요인" 판정 · 엔진 TEST_DOMAINS)
create table if not exists public.sw_ob_test_domains (
  instrument text not null,
  domain text not null,
  factor text not null,
  ord integer,
  constraint sw_ob_test_domains_pkey primary key (instrument, domain, factor)
);
alter table public.sw_ob_test_domains enable row level security;
revoke all on public.sw_ob_test_domains from anon, authenticated;
grant all on public.sw_ob_test_domains to service_role;

alter table public.sw_ob_test_domains add column if not exists ord integer;
-- 심리테스트 짝 뿌리(TRR-19 — 한쪽만 프로필 단서가 걸리면 다른 쪽 -0.5 · 엔진 TEST_PAIRS)
create table if not exists public.sw_ob_test_root_pairs (
  instrument text not null,
  root_a text not null,
  root_b text not null,
  rule text,
  constraint sw_ob_test_root_pairs_pkey primary key (instrument, root_a, root_b)
);
alter table public.sw_ob_test_root_pairs enable row level security;
revoke all on public.sw_ob_test_root_pairs from anon, authenticated;
grant all on public.sw_ob_test_root_pairs to service_role;

alter table public.sw_ob_test_root_pairs add column if not exists rule text;
-- 아스트로 Q1~Q3 답 → 공통 뿌리 점수(근거 D · 출처 astro_q · 뿌리당 최대 2.0)
create table if not exists public.sw_ob_astro_cues (
  q_id text not null,
  answer text not null,
  option_key text,
  root_id text not null,
  points numeric,
  constraint sw_ob_astro_cues_pkey primary key (q_id, answer, root_id)
);
alter table public.sw_ob_astro_cues enable row level security;
revoke all on public.sw_ob_astro_cues from anon, authenticated;
grant all on public.sw_ob_astro_cues to service_role;

alter table public.sw_ob_astro_cues add column if not exists option_key text;
alter table public.sw_ob_astro_cues add column if not exists points numeric;
-- 아스트로 Q 답 → 사다리 시작 가설
create table if not exists public.sw_ob_astro_cue_hyps (
  q_id text not null,
  answer text not null,
  hyp_id text not null,
  root_id text,
  w numeric,
  constraint sw_ob_astro_cue_hyps_pkey primary key (q_id, answer, hyp_id)
);
alter table public.sw_ob_astro_cue_hyps enable row level security;
revoke all on public.sw_ob_astro_cue_hyps from anon, authenticated;
grant all on public.sw_ob_astro_cue_hyps to service_role;

alter table public.sw_ob_astro_cue_hyps add column if not exists root_id text;
alter table public.sw_ob_astro_cue_hyps add column if not exists w numeric;
-- 별자리 → 원소(태양·달 조합 temper 키용 · 채팅에 쓰지 않음)
create table if not exists public.sw_ob_astro_sign_element (
  sign text not null,
  element text,
  constraint sw_ob_astro_sign_element_pkey primary key (sign)
);
alter table public.sw_ob_astro_sign_element enable row level security;
revoke all on public.sw_ob_astro_sign_element from anon, authenticated;
grant all on public.sw_ob_astro_sign_element to service_role;

alter table public.sw_ob_astro_sign_element add column if not exists element text;
-- 온보딩 보기 계열 묶음(가설 수렴 신호의 group·noneGroup — OB-06)
create table if not exists public.sw_ob_option_groups (
  group_id text not null,
  question_id text,
  option_key text not null,
  label text,
  constraint sw_ob_option_groups_pkey primary key (group_id, option_key)
);
alter table public.sw_ob_option_groups enable row level security;
revoke all on public.sw_ob_option_groups from anon, authenticated;
grant all on public.sw_ob_option_groups to service_role;

alter table public.sw_ob_option_groups add column if not exists question_id text;
alter table public.sw_ob_option_groups add column if not exists label text;
-- 가설 조건·조합 규칙이 쓰는 사용자 정보 칸(sw_user_signals slot) 목록 — 어디서 채우는지·지금 있는지
create table if not exists public.sw_ob_state_slots (
  slot text not null,
  meaning text,
  value_type text,
  value_list text,
  filled_by text,
  status text,
  used_by integer,
  constraint sw_ob_state_slots_pkey primary key (slot)
);
alter table public.sw_ob_state_slots enable row level security;
revoke all on public.sw_ob_state_slots from anon, authenticated;
grant all on public.sw_ob_state_slots to service_role;

alter table public.sw_ob_state_slots add column if not exists meaning text;
alter table public.sw_ob_state_slots add column if not exists value_type text;
alter table public.sw_ob_state_slots add column if not exists value_list text;
alter table public.sw_ob_state_slots add column if not exists filled_by text;
alter table public.sw_ob_state_slots add column if not exists status text;
alter table public.sw_ob_state_slots add column if not exists used_by integer;
-- 심리테스트 결과 디저트 → 유형(주 고민 영역-대처 방식)
create table if not exists public.sw_ob_dessert_types (
  instrument text,
  dessert_key text not null,
  test_type text,
  constraint sw_ob_dessert_types_pkey primary key (dessert_key)
);
alter table public.sw_ob_dessert_types enable row level security;
revoke all on public.sw_ob_dessert_types from anon, authenticated;
grant all on public.sw_ob_dessert_types to service_role;

alter table public.sw_ob_dessert_types add column if not exists instrument text;
alter table public.sw_ob_dessert_types add column if not exists test_type text;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_options_question_id' and conrelid = 'public.sw_ob_options'::regclass) then
  alter table public.sw_ob_options add constraint fk_sw_ob_options_question_id foreign key (question_id) references public.sw_ob_questions(question_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_roots_parent_root_id' and conrelid = 'public.sw_ob_roots'::regclass) then
  alter table public.sw_ob_roots add constraint fk_sw_ob_roots_parent_root_id foreign key (parent_root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_roots_opposite_root_id' and conrelid = 'public.sw_ob_roots'::regclass) then
  alter table public.sw_ob_roots add constraint fk_sw_ob_roots_opposite_root_id foreign key (opposite_root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_concepts_root_id' and conrelid = 'public.sw_ob_root_concepts'::regclass) then
  alter table public.sw_ob_root_concepts add constraint fk_sw_ob_root_concepts_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_scenes_question_id' and conrelid = 'public.sw_ob_scenes'::regclass) then
  alter table public.sw_ob_scenes add constraint fk_sw_ob_scenes_question_id foreign key (question_id) references public.sw_ob_questions(question_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_hypotheses_question_id' and conrelid = 'public.sw_ob_hypotheses'::regclass) then
  alter table public.sw_ob_hypotheses add constraint fk_sw_ob_hypotheses_question_id foreign key (question_id) references public.sw_ob_questions(question_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_hypotheses_root_id' and conrelid = 'public.sw_ob_hypotheses'::regclass) then
  alter table public.sw_ob_hypotheses add constraint fk_sw_ob_hypotheses_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_submotives_hyp_id' and conrelid = 'public.sw_ob_submotives'::regclass) then
  alter table public.sw_ob_submotives add constraint fk_sw_ob_submotives_hyp_id foreign key (hyp_id) references public.sw_ob_hypotheses(hyp_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_submotives_root_id' and conrelid = 'public.sw_ob_submotives'::regclass) then
  alter table public.sw_ob_submotives add constraint fk_sw_ob_submotives_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_leaves_sub_id' and conrelid = 'public.sw_ob_leaves'::regclass) then
  alter table public.sw_ob_leaves add constraint fk_sw_ob_leaves_sub_id foreign key (sub_id) references public.sw_ob_submotives(sub_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_leaves_root_id' and conrelid = 'public.sw_ob_leaves'::regclass) then
  alter table public.sw_ob_leaves add constraint fk_sw_ob_leaves_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_no_split_sub_id' and conrelid = 'public.sw_ob_no_split'::regclass) then
  alter table public.sw_ob_no_split add constraint fk_sw_ob_no_split_sub_id foreign key (sub_id) references public.sw_ob_submotives(sub_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_scene_links_scene_id' and conrelid = 'public.sw_ob_scene_links'::regclass) then
  alter table public.sw_ob_scene_links add constraint fk_sw_ob_scene_links_scene_id foreign key (scene_id) references public.sw_ob_scenes(scene_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_scene_links_hyp_id' and conrelid = 'public.sw_ob_scene_links'::regclass) then
  alter table public.sw_ob_scene_links add constraint fk_sw_ob_scene_links_hyp_id foreign key (hyp_id) references public.sw_ob_hypotheses(hyp_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_signal_roots_root_id' and conrelid = 'public.sw_ob_signal_roots'::regclass) then
  alter table public.sw_ob_signal_roots add constraint fk_sw_ob_signal_roots_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_practices_root_id' and conrelid = 'public.sw_ob_root_practices'::regclass) then
  alter table public.sw_ob_root_practices add constraint fk_sw_ob_root_practices_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_practice_child_pairs_root_id' and conrelid = 'public.sw_ob_practice_child_pairs'::regclass) then
  alter table public.sw_ob_practice_child_pairs add constraint fk_sw_ob_practice_child_pairs_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_hyp_chat_links_hyp_id' and conrelid = 'public.sw_ob_hyp_chat_links'::regclass) then
  alter table public.sw_ob_hyp_chat_links add constraint fk_sw_ob_hyp_chat_links_hyp_id foreign key (hyp_id) references public.sw_ob_hypotheses(hyp_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_practice_avoid_root_id' and conrelid = 'public.sw_ob_root_practice_avoid'::regclass) then
  alter table public.sw_ob_root_practice_avoid add constraint fk_sw_ob_root_practice_avoid_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_practice_coverage_root_id' and conrelid = 'public.sw_ob_root_practice_coverage'::regclass) then
  alter table public.sw_ob_root_practice_coverage add constraint fk_sw_ob_root_practice_coverage_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_theory_root_id' and conrelid = 'public.sw_ob_root_theory'::regclass) then
  alter table public.sw_ob_root_theory add constraint fk_sw_ob_root_theory_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_texts_root_id' and conrelid = 'public.sw_ob_root_texts'::regclass) then
  alter table public.sw_ob_root_texts add constraint fk_sw_ob_root_texts_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_test_root_cues_root_id' and conrelid = 'public.sw_ob_test_root_cues'::regclass) then
  alter table public.sw_ob_test_root_cues add constraint fk_sw_ob_test_root_cues_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_options_card_id' and conrelid = 'public.sw_ob_choice_options'::regclass) then
  alter table public.sw_ob_choice_options add constraint fk_sw_ob_choice_options_card_id foreign key (card_id) references public.sw_ob_choice_cards(card_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_options_next_card_id' and conrelid = 'public.sw_ob_choice_options'::regclass) then
  alter table public.sw_ob_choice_options add constraint fk_sw_ob_choice_options_next_card_id foreign key (next_card_id) references public.sw_ob_choice_cards(card_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_cards_parent_option_id' and conrelid = 'public.sw_ob_choice_cards'::regclass) then
  alter table public.sw_ob_choice_cards add constraint fk_sw_ob_choice_cards_parent_option_id foreign key (parent_option_id) references public.sw_ob_choice_options(option_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_practice_candidates_option_id' and conrelid = 'public.sw_ob_choice_practice_candidates'::regclass) then
  alter table public.sw_ob_choice_practice_candidates add constraint fk_sw_ob_choice_practice_candidates_option_id foreign key (option_id) references public.sw_ob_choice_options(option_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_practice_candidates_root_id' and conrelid = 'public.sw_ob_choice_practice_candidates'::regclass) then
  alter table public.sw_ob_choice_practice_candidates add constraint fk_sw_ob_choice_practice_candidates_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_scenes_first_card_id' and conrelid = 'public.sw_ob_choice_scenes'::regclass) then
  alter table public.sw_ob_choice_scenes add constraint fk_sw_ob_choice_scenes_first_card_id foreign key (first_card_id) references public.sw_ob_choice_cards(card_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_regression_scene_key' and conrelid = 'public.sw_ob_choice_regression'::regclass) then
  alter table public.sw_ob_choice_regression add constraint fk_sw_ob_choice_regression_scene_key foreign key (scene_key) references public.sw_ob_choice_scenes(scene_key) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_node_polarity_root_id' and conrelid = 'public.sw_ob_node_polarity'::regclass) then
  alter table public.sw_ob_node_polarity add constraint fk_sw_ob_node_polarity_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_test_root_pairs_root_a' and conrelid = 'public.sw_ob_test_root_pairs'::regclass) then
  alter table public.sw_ob_test_root_pairs add constraint fk_sw_ob_test_root_pairs_root_a foreign key (root_a) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_test_root_pairs_root_b' and conrelid = 'public.sw_ob_test_root_pairs'::regclass) then
  alter table public.sw_ob_test_root_pairs add constraint fk_sw_ob_test_root_pairs_root_b foreign key (root_b) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_astro_cues_root_id' and conrelid = 'public.sw_ob_astro_cues'::regclass) then
  alter table public.sw_ob_astro_cues add constraint fk_sw_ob_astro_cues_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_astro_cue_hyps_root_id' and conrelid = 'public.sw_ob_astro_cue_hyps'::regclass) then
  alter table public.sw_ob_astro_cue_hyps add constraint fk_sw_ob_astro_cue_hyps_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_astro_cue_hyps_hyp_id' and conrelid = 'public.sw_ob_astro_cue_hyps'::regclass) then
  alter table public.sw_ob_astro_cue_hyps add constraint fk_sw_ob_astro_cue_hyps_hyp_id foreign key (hyp_id) references public.sw_ob_hypotheses(hyp_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_claim_roots_claim_id' and conrelid = 'public.sw_ob_claim_roots'::regclass) then
  alter table public.sw_ob_claim_roots add constraint fk_sw_ob_claim_roots_claim_id foreign key (claim_id) references public.sw_ob_claims(claim_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_claim_roots_root_id' and conrelid = 'public.sw_ob_claim_roots'::regclass) then
  alter table public.sw_ob_claim_roots add constraint fk_sw_ob_claim_roots_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_options_claim_id' and conrelid = 'public.sw_ob_choice_options'::regclass) then
  alter table public.sw_ob_choice_options add constraint fk_sw_ob_choice_options_claim_id foreign key (claim_id) references public.sw_ob_claims(claim_id) deferrable initially deferred;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_signal_drafts_root_id' and conrelid = 'public.sw_ob_signal_drafts'::regclass) then
  alter table public.sw_ob_signal_drafts add constraint fk_sw_ob_signal_drafts_root_id foreign key (root_id) references public.sw_ob_roots(root_id) deferrable initially deferred;
end if; end $$;

-- 온보딩 보기 → 5축 점수(엔진 OPTION_AXES) — 원본은 sw_ob_options의 nov·soc·mov·gro·shr(따로 표를 두면 이중 원본이라 view로)
drop view if exists public.sw_ob_option_axes;   -- 칸이 늘어 다시 만듦(v1.9)
create view public.sw_ob_option_axes as
  select question_id, option_key, array[nov, soc, mov, gro, shr] as axes, nov, soc, mov, gro, shr, status, parent_key
    from public.sw_ob_options where question_id in ('weekends_ranked', 'hobbies_ranked', 'values_ranked');
revoke all on public.sw_ob_option_axes from anon, authenticated;
grant select on public.sw_ob_option_axes to service_role;

commit;

-- ===== CSO 20_sw_user_state_v4.5.sql =====
-- 쏘웰라(sw) 해석 DB v4.5 · 20 사용자 상태(민감 정보 — 서버 전용)
-- 지금 만듦(CSO 10-27 A1) · 민감 내용 원문은 개발 기존 방식대로 마스킹({건강} 등)해서 저장 · RLS 켬 + 정책 없음 = 사용자 앱에서 읽기·쓰기 불가 · 쏘웰라는 auth.users를 지우지 않음 · 대화를 지워도 근거·뿌리 상태는 남음(chat_id만 null)
-- 재실행 안전: CREATE TABLE IF NOT EXISTS · 제약은 이름 붙여 없을 때만 추가
begin;

-- v1.4 시험 표가 남아 있으면 멈춤: 장부 기본키가 (user_id, event_id)로 바뀜(B-1). 20·30 표는 운영에 아직 없으므로 새로 만듦
do $$ begin
  if to_regclass('public.sw_evidence_events') is not null and not exists (
       select 1 from pg_constraint where conrelid = to_regclass('public.sw_evidence_events') and contype = 'p' and array_length(conkey, 1) = 2) then
    raise exception 'v1.4의 sw_evidence_events(기본키 event_id 하나)가 남아 있습니다. 시험 DB라면 20·30 표를 지우고 다시 실행하세요';
  end if;
end $$;

-- 모든 정보를 한 줄씩 쌓는 칸(덮어쓰지 않고 추가 — 기록 삭제 요청 = 숨김(hidden_at, 통계·서비스 개선용 보관) · 계정 삭제 = 실제 삭제 · 미이용 12개월 숨김 → 24개월 실제 삭제(F4)) — 현재 값 = slot별 observed_at 최신(동시각이면 chat>test>onboarding)
create table if not exists public.sw_user_signals (
  id bigint generated always as identity not null,
  user_id uuid not null,
  slot text not null,
  value jsonb,
  source text,
  observed_at timestamptz not null default now(),
  ref text,
  retracted_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sw_user_signals_pkey primary key (id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_signals_user' and conrelid = 'public.sw_user_signals'::regclass) then
  alter table public.sw_user_signals add constraint fk_sw_user_signals_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_user_signals_user on public.sw_user_signals (user_id);
alter table public.sw_user_signals enable row level security;
revoke all on public.sw_user_signals from anon, authenticated;
grant all on public.sw_user_signals to service_role;

-- 사용자×공통 뿌리 1행 — 가설 상태는 여기(가설별 상태 칸 쓰지 않음)
create table if not exists public.sw_user_root_state (
  user_id uuid not null,
  root_id text not null,
  status text not null default 'candidate',
  use_direction text,
  use_direction_at timestamptz,
  score numeric not null default 0,
  sources jsonb not null default '[]'::jsonb,
  onboarding_cue numeric not null default 0,
  onboarding_from text,
  combo_bonus numeric not null default 0,
  current_member text,
  ladder_step integer not null default 0,
  current_node text,
  answer text,
  answered_at timestamptz,
  answered_chat_id uuid,
  safety_group text,
  turns_total integer not null default 0,
  turns_since_improve integer not null default 0,
  last_improve_at timestamptz,
  last_improve_chat_id uuid,
  last_improve_text text,
  escalate_seen jsonb not null default '{}'::jsonb,
  escalated_at timestamptz,
  escalated_reason text,
  caution_hold boolean not null default false,
  safety2_level text,
  safety2_signals jsonb not null default '[]'::jsonb,
  safety2_at timestamptz,
  crisis_history_ref text,
  human_suggested_at timestamptz,
  human_suggested_chat_id uuid,
  human_declined_at timestamptz,
  human_phrase_last text,
  updated_at timestamptz not null default now(),
  constraint sw_user_root_state_pkey primary key (user_id, root_id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_root_state_user' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint fk_sw_user_root_state_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_user_root_state_user on public.sw_user_root_state (user_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_root_state_answered_chat_id' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint fk_sw_user_root_state_answered_chat_id foreign key (answered_chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_root_state_human_suggested_chat_id' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint fk_sw_user_root_state_human_suggested_chat_id foreign key (human_suggested_chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_root_state_last_improve_chat_id' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint fk_sw_user_root_state_last_improve_chat_id foreign key (last_improve_chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_user_root_state_root' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint fk_sw_user_root_state_root foreign key (root_id) references public.sw_ob_roots(root_id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_user_root_state_status' and conrelid = 'public.sw_user_root_state'::regclass) then
  alter table public.sw_user_root_state add constraint ck_sw_user_root_state_status check (status in ('candidate','likely','confirmed','rejected'));
end if; end $$;
alter table public.sw_user_root_state enable row level security;
revoke all on public.sw_user_root_state from anon, authenticated;
grant all on public.sw_user_root_state to service_role;

-- 근거 장부 — 사건 1건 1행 · 점수·확인·목표의 유일한 원본(엔진 상태는 활성 사건에서 다시 만듦) · 같은 사건 재전송은 멱등 · 정정·재검사는 supersede
create table if not exists public.sw_evidence_events (
  user_id uuid not null,
  event_id text not null,
  seq bigint generated always as identity,
  event_kind text not null default 'evidence',
  source_type text not null,
  root_id text not null,
  points numeric not null default 0,
  link text not null default 'support',
  polarity text not null default 'present',
  status_to text,
  claim_id text,
  chat_id uuid,
  confirmation_scope jsonb,
  meta jsonb not null default '{}'::jsonb,
  validity text not null default 'active',
  supersedes_event_id text,
  content_hash text,
  record_id text,
  origin_event_id text,
  scope_id text,
  hypothesis_id text,
  relation text,
  actor text,
  is_hypothetical boolean,
  consent_scope text,
  score_spec_version text,
  hidden_at timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sw_evidence_events_pkey primary key (user_id, event_id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_evidence_events_user' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint fk_sw_evidence_events_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_evidence_events_user on public.sw_evidence_events (user_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_evidence_events_chat_id' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint fk_sw_evidence_events_chat_id foreign key (chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_evidence_events_root' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint fk_sw_evidence_events_root foreign key (root_id) references public.sw_ob_roots(root_id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_kind' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_kind check (event_kind in ('evidence','status','goal_confirm'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_source' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_source check (source_type in ('chat','test','human','onboarding','astro_q','astro_profile'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_link' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_link check (link in ('support','conditional','goal'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_polarity' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_polarity check (polarity in ('present','absent','desired'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_validity' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_validity check (validity in ('active','superseded','hidden'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_status' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_status check (status_to is null or status_to in ('candidate','likely','confirmed','rejected'));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_evidence_events_points' and conrelid = 'public.sw_evidence_events'::regclass) then
  alter table public.sw_evidence_events add constraint ck_sw_evidence_events_points check (event_kind = 'evidence' and (link = 'support' or points = 0) or event_kind <> 'evidence' and points = 0);
end if; end $$;
alter table public.sw_evidence_events enable row level security;
revoke all on public.sw_evidence_events from anon, authenticated;
grant all on public.sw_evidence_events to service_role;

-- 선택지 카드 탐색 1회 1행(대화별) — 대화 턴 사이에 세션을 이어가는 값(엔진 sessionToRow/sessionFromRow)
create table if not exists public.sw_choice_sessions (
  id bigint generated always as identity not null,
  user_id uuid not null,
  chat_id uuid,
  started_card_id text,
  card_id text,
  last_option_id text,
  cards_shown integer not null default 0,
  shown jsonb not null default '{}'::jsonb,
  path jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  dk_count integer not null default 0,
  pending_branch text,
  ended text,
  no_root_label text,
  generalized boolean,
  hidden_at timestamptz,
  at timestamptz not null default now(),
  constraint sw_choice_sessions_pkey primary key (id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_choice_sessions_user' and conrelid = 'public.sw_choice_sessions'::regclass) then
  alter table public.sw_choice_sessions add constraint fk_sw_choice_sessions_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_choice_sessions_user on public.sw_choice_sessions (user_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_choice_sessions_chat_id' and conrelid = 'public.sw_choice_sessions'::regclass) then
  alter table public.sw_choice_sessions add constraint fk_sw_choice_sessions_chat_id foreign key (chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
alter table public.sw_choice_sessions enable row level security;
revoke all on public.sw_choice_sessions from anon, authenticated;
grant all on public.sw_choice_sessions to service_role;

-- 🛡 ① 갈래 턴마다 1행(판단 근거)
create table if not exists public.sw_root_turn_log (
  id bigint generated always as identity not null,
  user_id uuid not null,
  root_id text not null,
  chat_id uuid,
  at timestamptz not null default now(),
  member text,
  node text,
  turns_total integer not null default 0,
  turns_since_improve integer not null default 0,
  improve boolean,
  escalate jsonb,
  safety2 jsonb,
  decision text,
  hidden_at timestamptz,
  constraint sw_root_turn_log_pkey primary key (id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_root_turn_log_user' and conrelid = 'public.sw_root_turn_log'::regclass) then
  alter table public.sw_root_turn_log add constraint fk_sw_root_turn_log_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_root_turn_log_user on public.sw_root_turn_log (user_id);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_root_turn_log_chat_id' and conrelid = 'public.sw_root_turn_log'::regclass) then
  alter table public.sw_root_turn_log add constraint fk_sw_root_turn_log_chat_id foreign key (chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_root_turn_log_root' and conrelid = 'public.sw_root_turn_log'::regclass) then
  alter table public.sw_root_turn_log add constraint fk_sw_root_turn_log_root foreign key (root_id) references public.sw_ob_roots(root_id);
end if; end $$;
alter table public.sw_root_turn_log enable row level security;
revoke all on public.sw_root_turn_log from anon, authenticated;
grant all on public.sw_root_turn_log to service_role;

-- v4.2 G3 활용/끌려다님 칸(재실행 안전)
alter table public.sw_user_root_state add column if not exists use_direction text;
alter table public.sw_user_root_state add column if not exists use_direction_at timestamptz;

-- v3.9 A2 숨김 칸: 이미 만든 표에도 붙도록(재실행 안전)
alter table public.sw_user_signals add column if not exists hidden_at timestamptz;
alter table public.sw_evidence_events add column if not exists hidden_at timestamptz;
alter table public.sw_choice_sessions add column if not exists hidden_at timestamptz;
alter table public.sw_root_turn_log add column if not exists hidden_at timestamptz;

alter table public.sw_evidence_events drop constraint if exists ck_sw_evidence_events_validity;
alter table public.sw_evidence_events add constraint ck_sw_evidence_events_validity check (validity in ('active','superseded','hidden'));

create index if not exists ix_sw_user_signals_slot on public.sw_user_signals (user_id, slot, observed_at desc);
create index if not exists ix_sw_evidence_events_root on public.sw_evidence_events (user_id, root_id, seq) where validity = 'active';
create index if not exists ix_sw_root_turn_log_root on public.sw_root_turn_log (user_id, root_id, at);

-- 이전 판의 함수 모양(인자 목록이 바뀜) 정리 — 재실행 안전
drop function if exists public.sw_apply_evidence(text, uuid, text, text, numeric, text, text, text, uuid, text, jsonb);
drop function if exists public.sw_supersede_event(text, text);
drop function if exists public.sw_set_root_status(uuid, text, text, jsonb);

-- 뿌리 하나 다시 계산: 장부의 활성 사건만으로(모든 출처 — chat·test·human·onboarding·astro_q·astro_profile) · A-3
--   점수 = 활성 근거 사건 합 · 출처 = 점수가 있는 활성 근거의 출처 · 온보딩 단서 = 활성 온보딩 근거 중 가장 큰 값
--   상태 = 마지막 활성 상태 사건이 confirmed/rejected면 그것, 아니면 점수 3 이상 + 출처 2곳 이상(아스트로는 1곳으로 셈) → likely, 그 밖 candidate
create or replace function public.sw_recompute_root(p_user uuid, p_root text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_score numeric; v_sources jsonb; v_fam int; v_onb numeric; v_last text; v_status text;
begin
  select coalesce(sum(points), 0) into v_score from public.sw_evidence_events
   where user_id = p_user and root_id = p_root and validity = 'active' and event_kind = 'evidence';
  select coalesce(jsonb_agg(distinct source_type), '[]'::jsonb), count(distinct case when source_type like 'astro%' then 'astro' else source_type end)
    into v_sources, v_fam from public.sw_evidence_events
   where user_id = p_user and root_id = p_root and validity = 'active' and event_kind = 'evidence' and points <> 0;
  select coalesce(max(points), 0) into v_onb from public.sw_evidence_events
   where user_id = p_user and root_id = p_root and validity = 'active' and event_kind = 'evidence' and source_type = 'onboarding';
  select status_to into v_last from public.sw_evidence_events
   where user_id = p_user and root_id = p_root and validity = 'active' and event_kind = 'status' order by seq desc limit 1;
  v_status := case when v_last in ('confirmed', 'rejected') then v_last when v_score >= 3 and v_fam >= 2 then 'likely' else 'candidate' end;
  insert into public.sw_user_root_state as u (user_id, root_id, status, score, sources, onboarding_cue, updated_at)
  values (p_user, p_root, v_status, v_score, v_sources, v_onb, now())
  on conflict (user_id, root_id) do update
    set status = excluded.status, score = excluded.score, sources = excluded.sources, onboarding_cue = excluded.onboarding_cue, updated_at = now();
end $$;
revoke all on function public.sw_recompute_root(uuid, text) from public, anon, authenticated;
grant execute on function public.sw_recompute_root(uuid, text) to service_role;

-- 사건 1건 기록(원자적·멱등): 같은 (user_id, event_id) 재전송은 무시, 내용이 다르면 오류 → 그 뿌리를 장부에서 다시 계산
--   같은 사용자·뿌리는 잠금으로 줄 세움(동시 접속에도 합계가 맞음)
create or replace function public.sw_apply_evidence(
  p_user uuid, p_event_id text, p_root text, p_source text, p_points numeric,
  p_link text default 'support', p_polarity text default 'present', p_claim text default null, p_chat uuid default null,
  p_meta jsonb default '{}'::jsonb, p_observed_at timestamptz default null, p_hash text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_pts numeric := case when p_link = 'support' then coalesce(p_points, 0) else 0 end;
begin
  v_hash := coalesce(p_hash, md5(jsonb_build_array('evidence', p_root, p_source, v_pts, p_link, p_polarity, p_claim)::text));
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || '|' || p_root, 0));
  insert into public.sw_evidence_events (user_id, event_id, event_kind, root_id, source_type, points, link, polarity, claim_id, chat_id, meta, validity, content_hash, observed_at)
  values (p_user, p_event_id, 'evidence', p_root, p_source, v_pts, p_link, p_polarity, p_claim, p_chat, coalesce(p_meta, '{}'::jsonb), 'active', v_hash, coalesce(p_observed_at, now()))
  on conflict (user_id, event_id) do nothing;
  if not found then
    select content_hash into v_hash from public.sw_evidence_events where user_id = p_user and event_id = p_event_id;
    if v_hash is distinct from coalesce(p_hash, md5(jsonb_build_array('evidence', p_root, p_source, v_pts, p_link, p_polarity, p_claim)::text)) then
      raise exception 'event_id % 내용 불일치(사용자 %)', p_event_id, p_user; end if;
    return 'duplicate';
  end if;
  perform public.sw_recompute_root(p_user, p_root);
  return case when v_pts = 0 then 'recorded_no_score' else 'applied' end;   -- 조건부·목표는 0점 기록
end $$;
revoke all on function public.sw_apply_evidence(uuid, text, text, text, numeric, text, text, text, uuid, jsonb, timestamptz, text) from public, anon, authenticated;
grant execute on function public.sw_apply_evidence(uuid, text, text, text, numeric, text, text, text, uuid, jsonb, timestamptz, text) to service_role;

-- 확인·거절·목표 확인도 장부 1행(event_kind status / goal_confirm) → 다시 계산. 상태는 마지막 활성 상태 사건이 정함
create or replace function public.sw_set_root_status(
  p_user uuid, p_event_id text, p_root text, p_kind text default 'status', p_status text default null, p_source text default 'chat',
  p_scope jsonb default null, p_chat uuid default null, p_meta jsonb default '{}'::jsonb, p_observed_at timestamptz default null, p_hash text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_st text := case when p_kind = 'status' then p_status end;
begin
  v_hash := coalesce(p_hash, md5(jsonb_build_array(p_kind, p_root, p_source, v_st, p_scope)::text));
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || '|' || p_root, 0));
  insert into public.sw_evidence_events (user_id, event_id, event_kind, root_id, source_type, points, link, polarity, status_to, confirmation_scope, chat_id, meta, validity, content_hash, observed_at)
  values (p_user, p_event_id, p_kind, p_root, p_source, 0, 'support', 'present', v_st, p_scope, p_chat, coalesce(p_meta, '{}'::jsonb), 'active', v_hash, coalesce(p_observed_at, now()))
  on conflict (user_id, event_id) do nothing;
  if not found then
    select content_hash into v_hash from public.sw_evidence_events where user_id = p_user and event_id = p_event_id;
    if v_hash is distinct from coalesce(p_hash, md5(jsonb_build_array(p_kind, p_root, p_source, v_st, p_scope)::text)) then
      raise exception 'event_id % 내용 불일치(사용자 %)', p_event_id, p_user; end if;
    return 'duplicate';
  end if;
  perform public.sw_recompute_root(p_user, p_root);
  return 'recorded';
end $$;
revoke all on function public.sw_set_root_status(uuid, text, text, text, text, text, jsonb, uuid, jsonb, timestamptz, text) from public, anon, authenticated;
grant execute on function public.sw_set_root_status(uuid, text, text, text, text, text, jsonb, uuid, jsonb, timestamptz, text) to service_role;

-- 정정·재검사·재반영: 사건을 superseded로 → 그 뿌리를 다시 계산(다른 출처 점수는 그대로)
create or replace function public.sw_supersede_event(p_user uuid, p_event_id text, p_by text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_root text;
begin
  select root_id into v_root from public.sw_evidence_events where user_id = p_user and event_id = p_event_id;
  if v_root is null then return 'not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || '|' || v_root, 0));
  update public.sw_evidence_events set validity = 'superseded', supersedes_event_id = coalesce(supersedes_event_id, p_by)
   where user_id = p_user and event_id = p_event_id and validity = 'active';
  if not found then return 'already'; end if;
  perform public.sw_recompute_root(p_user, v_root);
  return 'superseded';
end $$;
revoke all on function public.sw_supersede_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.sw_supersede_event(uuid, text, text) to service_role;

-- 엔진이 돌려준 사건 목록(events · sess.events)을 순서대로 한 트랜잭션에 기록 — 서버는 이 함수 하나만 불러도 됨
--   op: apply → sw_apply_evidence · set_status / goal_confirm → sw_set_root_status · supersede → sw_supersede_event
--   chat_id가 uuid가 아니면 null로 두고 meta.chat_ref에 남김
create or replace function public.sw_apply_ops(p_user uuid, p_ops jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o jsonb; v jsonb := '[]'::jsonb; r text; v_chat uuid; v_meta jsonb;
begin
  for o in select x from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) as t(x) loop
    if o ? 'user_id' and (o->>'user_id')::uuid is distinct from p_user then raise exception 'op의 user_id가 다름: %', o->>'event_id'; end if;
    v_chat := case when (o->>'chat_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (o->>'chat_id')::uuid end;
    v_meta := coalesce(o->'meta', '{}'::jsonb) || case when o->>'chat_id' is not null then jsonb_build_object('chat_ref', o->>'chat_id') else '{}'::jsonb end;
    if o->>'op' = 'apply' then
      r := public.sw_apply_evidence(p_user, o->>'event_id', o->>'root_id', o->>'source_type', (o->>'points')::numeric,
             coalesce(o->>'link', 'support'), coalesce(o->>'polarity', 'present'), o->>'claim_id', v_chat, v_meta, (o->>'observed_at')::timestamptz, null);
    elsif o->>'op' in ('set_status', 'goal_confirm') then
      r := public.sw_set_root_status(p_user, o->>'event_id', o->>'root_id', case when o->>'op' = 'goal_confirm' then 'goal_confirm' else 'status' end,
             o->>'status_to', coalesce(o->>'source_type', 'chat'), o->'confirmation_scope', v_chat, v_meta, (o->>'observed_at')::timestamptz, null);
    elsif o->>'op' = 'supersede' then
      r := public.sw_supersede_event(p_user, o->>'event_id', o->>'by');
    elsif o->>'op' = 'candidate' then
      r := 'skipped_candidate';   -- 분류기 후보(0.5~0.7)는 장부에 넣지 않음
    else raise exception '알 수 없는 op: %', o->>'op'; end if;
    v := v || jsonb_build_array(jsonb_build_object('event_id', o->>'event_id', 'op', o->>'op', 'result', r));
  end loop;
  return v;
end $$;
revoke all on function public.sw_apply_ops(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sw_apply_ops(uuid, jsonb) to service_role;

-- 엔진 hydrate()에 넘길 장부 읽기(seq 순 · 정정된 사건 포함 — 엔진이 id 겹침을 피하는 데 씀)
create or replace function public.sw_read_ledger(p_user uuid)
returns setof public.sw_evidence_events language sql stable security definer set search_path = '' as $$
  select * from public.sw_evidence_events where user_id = p_user order by seq;
$$;
revoke all on function public.sw_read_ledger(uuid) from public, anon, authenticated;
grant execute on function public.sw_read_ledger(uuid) to service_role;

commit;

-- ===== CSO 30_sw_human_session_v4.5.sql =====
-- 쏘웰라(sw) 해석 DB v4.5 · 30 휴먼 세션(상담사 판단 — 사용자에게 절대 노출 안 함)
-- RLS 켬 + 정책 없음 · service_role(서버)만 · 상담 원문은 이 DB에 두지 않음(HSR-09) · 판단을 AI에 반영할 때는 엔진 applyHumanSession → 장부 사건(source human)
-- 재실행 안전: CREATE TABLE IF NOT EXISTS · 제약은 이름 붙여 없을 때만 추가
begin;

-- 휴먼 세션 1회 1행(상담사 입력 · 동의·공유 범위)
create table if not exists public.sw_hs_sessions (
  session_id uuid not null,
  user_id uuid not null,
  counselor_id uuid,
  session_at timestamptz,
  session_type text,
  consent_ai_use boolean not null default false,
  share_scope text,
  next_session text,
  created_at timestamptz not null default now(),
  constraint sw_hs_sessions_pkey primary key (session_id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hs_sessions_user' and conrelid = 'public.sw_hs_sessions'::regclass) then
  alter table public.sw_hs_sessions add constraint fk_sw_hs_sessions_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
create index if not exists ix_sw_hs_sessions_user on public.sw_hs_sessions (user_id);
alter table public.sw_hs_sessions enable row level security;
revoke all on public.sw_hs_sessions from anon, authenticated;
grant all on public.sw_hs_sessions to service_role;

-- 휴먼 세션 뿌리 판단(근거 A등급)
create table if not exists public.sw_hs_root_judgments (
  session_id uuid not null,
  root_id text not null,
  judgment text,
  child_root_id text,
  confidence integer,
  user_agreed text,
  note_to_ai text,
  suggested_theory jsonb,
  suggested_practices jsonb,
  avoid_practices jsonb,
  new_root_note text,
  applied_at timestamptz,
  constraint sw_hs_root_judgments_pkey primary key (session_id, root_id)
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hs_root_judgments_root' and conrelid = 'public.sw_hs_root_judgments'::regclass) then
  alter table public.sw_hs_root_judgments add constraint fk_sw_hs_root_judgments_root foreign key (root_id) references public.sw_ob_roots(root_id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'ck_sw_hs_root_judgments_judgment' and conrelid = 'public.sw_hs_root_judgments'::regclass) then
  alter table public.sw_hs_root_judgments add constraint ck_sw_hs_root_judgments_judgment check (judgment in ('confirmed','partial','rejected','not_discussed'));
end if; end $$;
alter table public.sw_hs_root_judgments enable row level security;
revoke all on public.sw_hs_root_judgments from anon, authenticated;
grant all on public.sw_hs_root_judgments to service_role;

-- 휴먼 세션 안전 관찰(내용 없이 단계만)
create table if not exists public.sw_hs_safety (
  session_id uuid not null,
  safety_level text,
  referral_done text,
  ai_caution text,
  ai_avoid_topic text,
  constraint sw_hs_safety_pkey primary key (session_id)
);
alter table public.sw_hs_safety enable row level security;
revoke all on public.sw_hs_safety from anon, authenticated;
grant all on public.sw_hs_safety to service_role;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hs_root_judgments_session' and conrelid = 'public.sw_hs_root_judgments'::regclass) then
  alter table public.sw_hs_root_judgments add constraint fk_sw_hs_root_judgments_session foreign key (session_id) references public.sw_hs_sessions(session_id) on delete cascade;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hs_safety_session' and conrelid = 'public.sw_hs_safety'::regclass) then
  alter table public.sw_hs_safety add constraint fk_sw_hs_safety_session foreign key (session_id) references public.sw_hs_sessions(session_id) on delete cascade;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hs_root_judgments_child' and conrelid = 'public.sw_hs_root_judgments'::regclass) then
  alter table public.sw_hs_root_judgments add constraint fk_sw_hs_root_judgments_child foreign key (child_root_id) references public.sw_ob_roots(root_id);
end if; end $$;
create index if not exists ix_sw_hs_root_judgments_session on public.sw_hs_root_judgments (session_id);

commit;

-- ===== CSO 40_sw_retention_v4.5.sql =====
-- 쏘웰라(sw) 해석 DB v4.5 · 40 삭제·보관
-- 기록 삭제 요청 = 숨김(sw_hide_user_records · 통계·서비스 개선용 보관) · 계정 삭제 = 실제 삭제(sw_purge_user) · 비식별 주별 집계(sw_stats_root_weekly, 최대 3년) · 쏘웰라 소유 sw_ 표의 행만 지움 · auth.users(공유 계정)·결제·다른 앱 표(ssol_* 등)·기존 쏘웰라 표(chat_*)는 절대 건드리지 않음 · 계정 자체 삭제는 전체 서비스 탈퇴 절차(법률 검토)로 분리
-- 재실행 안전: CREATE TABLE IF NOT EXISTS · 제약은 이름 붙여 없을 때만 추가
begin;

drop function if exists public.sw_purge_inactive(int);   -- v1.4 모양(반환 int) 정리

-- 쏘웰라 데이터 실제 삭제(계정 삭제·탈퇴 — CSO 10-27 A2: 기록 삭제 요청은 숨김 sw_hide_user_records): 쏘웰라 소유 표의 행만(숨긴 행 포함) — auth.users·결제·다른 앱·chat_* 표는 대상 아님
--   p_include_human: 휴먼 세션 판단(sw_hs_*)도 지울지 — 보관 기준은 법률 검토 후(기본 false = 남김)
create or replace function public.sw_purge_user(p_user uuid, p_include_human boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb := '{}'::jsonb; n int;
begin
  delete from public.sw_evidence_events where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_evidence_events', n);
  delete from public.sw_choice_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_choice_sessions', n);
  delete from public.sw_root_turn_log where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_root_turn_log', n);
  delete from public.sw_user_root_state where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_root_state', n);
  delete from public.sw_user_signals where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_signals', n);
  if p_include_human then
    delete from public.sw_hs_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_hs_sessions', n);   -- sw_hs_root_judgments·sw_hs_safety 연쇄
  end if;
  return v;   -- 지운 행 수(감사 기록용)
end $$;
revoke all on function public.sw_purge_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.sw_purge_user(uuid, boolean) to service_role;

-- 쏘웰라 마지막 이용(B-5): 쏘웰라 해석 기록 + 쏘웰라 대화(chat_sessions.last_message_at · chat_messages.created_at)
--   공유 계정의 last_sign_in_at·profiles·user_onboarding 수정 시각은 쓰지 않음(로그인 유지·접속만으로 바뀌거나 안 바뀜)
create or replace view public.sw_user_last_activity as
  select user_id, max(at) as last_at from (
    select user_id, created_at as at from public.sw_user_signals
    union all select user_id, created_at from public.sw_evidence_events
    union all select user_id, at from public.sw_choice_sessions
    union all select user_id, at from public.sw_root_turn_log
    union all select user_id, updated_at from public.sw_user_root_state
    union all select user_id, last_message_at from public.chat_sessions
    union all select user_id, created_at from public.chat_messages
  ) x where user_id is not null group by user_id;
revoke all on public.sw_user_last_activity from anon, authenticated;
grant select on public.sw_user_last_activity to service_role;

-- 쏘웰라 미이용 정리(B-6 · CSO 10-27 F4): p_hide_months개월 미이용 → 숨김(sw_hide_user_records) · p_delete_months개월 미이용 → 실제 삭제(sw_purge_user)
--   방침: 대화 원문 24개월 · 비식별 통계 최대 3년(sw_stats_root_weekly는 user_id 없어 그대로 남음)
--   ① 유효 이용권(chat_entitlements: status='active' 이고 expires_at 없음 또는 미래)이 있는 사용자는 제외
--   ② p_dry_run 기본 true = 대상 사용자 수·행 수만 돌려주고 바꾸지 않음
--   ③ 실제 실행이면 숨긴 사용자 수와 지운 행 수(표별 합계)를 jsonb로
drop function if exists public.sw_purge_inactive(int, boolean);   -- v3.9 모양(12개월 바로 삭제) 정리
create or replace function public.sw_purge_inactive(p_hide_months int default 12, p_delete_months int default 24, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_del uuid[]; v_hide uuid[]; u uuid; d jsonb; k text; tot jsonb := '{}'::jsonb;
begin
  if p_hide_months is null or p_hide_months < 1 or p_delete_months is null or p_delete_months < p_hide_months then raise exception '1 ≤ 숨김 개월 ≤ 삭제 개월'; end if;
  select coalesce(array_agg(a.user_id), '{}') into v_del
    from public.sw_user_last_activity a
   where a.last_at < now() - make_interval(months => p_delete_months)
     and not exists (select 1 from public.chat_entitlements e
                      where e.user_id = a.user_id and e.status = 'active' and (e.expires_at is null or e.expires_at > now()));
  select coalesce(array_agg(a.user_id), '{}') into v_hide
    from public.sw_user_last_activity a
   where a.last_at < now() - make_interval(months => p_hide_months) and not (a.user_id = any(v_del))
     and exists (select 1 from public.sw_evidence_events x where x.user_id = a.user_id and x.validity <> 'hidden'
                 union all select 1 from public.sw_user_signals s where s.user_id = a.user_id and s.hidden_at is null)
     and not exists (select 1 from public.chat_entitlements e
                      where e.user_id = a.user_id and e.status = 'active' and (e.expires_at is null or e.expires_at > now()));
  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'hide_months', p_hide_months, 'delete_months', p_delete_months,
      'hide_users', cardinality(v_hide), 'delete_users', cardinality(v_del), 'delete_rows', jsonb_build_object(
      'sw_evidence_events', (select count(*) from public.sw_evidence_events where user_id = any(v_del)),
      'sw_choice_sessions', (select count(*) from public.sw_choice_sessions where user_id = any(v_del)),
      'sw_root_turn_log', (select count(*) from public.sw_root_turn_log where user_id = any(v_del)),
      'sw_user_root_state', (select count(*) from public.sw_user_root_state where user_id = any(v_del)),
      'sw_user_signals', (select count(*) from public.sw_user_signals where user_id = any(v_del))));
  end if;
  foreach u in array v_hide loop perform public.sw_hide_user_records(u, 'inactive_' || p_hide_months || 'm'); end loop;
  foreach u in array v_del loop
    d := public.sw_purge_user(u, false);
    for k in select jsonb_object_keys(d) loop
      tot := tot || jsonb_build_object(k, coalesce((tot->>k)::int, 0) + (d->>k)::int);
    end loop;
  end loop;
  return jsonb_build_object('dry_run', false, 'hide_users', cardinality(v_hide), 'delete_users', cardinality(v_del), 'delete_rows', tot);
end $$;
revoke all on function public.sw_purge_inactive(int, int, boolean) from public, anon, authenticated;
grant execute on function public.sw_purge_inactive(int, int, boolean) to service_role;

-- A2(CSO 10-27): 사용자의 "기록 지워 주세요" = 숨김 — 점수·대화에서 빠지고, 통계·서비스 개선용으로 보관(개인정보 처리방침에 명시)
--   장부 사건은 validity = 'hidden'(다시 계산에서 빠짐) · 신호·카드 탐색·턴 기록은 hidden_at · 뿌리 상태(파생 캐시)는 지움 → 남은 활성 사건으로 다시 만듦
--   계정 삭제(탈퇴)는 sw_purge_user = 실제 삭제(숨긴 행 포함) · 숨김은 되돌리지 않음(사용자에게 보이지 않음)
create or replace function public.sw_hide_user_records(p_user uuid, p_reason text default 'user_request')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb := '{}'::jsonb; n int;
begin
  update public.sw_evidence_events set validity = 'hidden', hidden_at = now(), meta = meta || jsonb_build_object('hidden_reason', p_reason)
   where user_id = p_user and validity <> 'hidden'; get diagnostics n = row_count; v := v || jsonb_build_object('sw_evidence_events', n);
  update public.sw_user_signals set hidden_at = now() where user_id = p_user and hidden_at is null; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_signals', n);
  update public.sw_choice_sessions set hidden_at = now() where user_id = p_user and hidden_at is null; get diagnostics n = row_count; v := v || jsonb_build_object('sw_choice_sessions', n);
  update public.sw_root_turn_log set hidden_at = now() where user_id = p_user and hidden_at is null; get diagnostics n = row_count; v := v || jsonb_build_object('sw_root_turn_log', n);
  delete from public.sw_user_root_state where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_root_state_cache', n);
  return v;
end $$;
revoke all on function public.sw_hide_user_records(uuid, text) from public, anon, authenticated;
grant execute on function public.sw_hide_user_records(uuid, text) to service_role;

-- A2 비식별 집계(CSO 10-27 · 방침 예고: 개인을 알 수 없게 한 통계 최대 3년): user_id 없는 주별 뿌리·출처 집계 — 계정 삭제 뒤에도 남음
create table if not exists public.sw_stats_root_weekly (
  week date not null,
  root_id text not null,
  source_type text not null,
  events int not null default 0,
  users int not null default 0,
  refreshed_at timestamptz not null default now(),
  constraint sw_stats_root_weekly_pkey primary key (week, root_id, source_type)
);
alter table public.sw_stats_root_weekly enable row level security;
revoke all on public.sw_stats_root_weekly from anon, authenticated;
grant all on public.sw_stats_root_weekly to service_role;

-- 집계 갱신: p_weeks 주 전부터 다시 셈(숨긴 사건 포함 · 대체된 사건 제외) · 3년 지난 주는 지움
create or replace function public.sw_stats_refresh(p_weeks int default 2)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.sw_stats_root_weekly as s (week, root_id, source_type, events, users, refreshed_at)
  select date_trunc('week', observed_at)::date, root_id, source_type, count(*), count(distinct user_id), now()
    from public.sw_evidence_events
   where validity in ('active', 'hidden') and event_kind = 'evidence' and observed_at >= date_trunc('week', now()) - make_interval(weeks => p_weeks)
   group by 1, 2, 3
  on conflict (week, root_id, source_type) do update set events = excluded.events, users = excluded.users, refreshed_at = now();
  get diagnostics n = row_count;
  delete from public.sw_stats_root_weekly where week < (now() - interval '3 years')::date;
  return n;
end $$;
revoke all on function public.sw_stats_refresh(int) from public, anon, authenticated;
grant execute on function public.sw_stats_refresh(int) to service_role;

-- pg_cron 사용 여부는 Supabase 대시보드 Database → Extensions에서 확인. 처음에는 드라이런 결과만 받아 봄:
--   select public.sw_purge_inactive(12, 24);           -- 드라이런(기본): 12개월 숨김 대상·24개월 삭제 대상 수
--   select public.sw_purge_inactive(12, 24, false);    -- 실제 실행(사람 확인 뒤)

commit;

-- ===== 우리 50_sw_hypothesis_log_v1.sql (마지막) =====
-- 쏘웰라 해석 DB · 50 가설 판정 기록 (확률 방향 대비 — 2026-10-18 대표 결정, 요청서 G-2)
-- 목적: 나중에 점수를 확률로 보정하려면 "그 턴의 후보·점수·누가 골랐나·사용자 반응"이 남아 있어야 한다. 지금부터 기록만 쌓는다(판정에는 쓰지 않음).
-- 추가 전용: 새 표 1개 + 삭제 함수 확장(이 표도 지움). 기존 표·데이터는 바꾸지 않는다. 40 다음에 실행(apply_v1.6.sql에 포함).
create table if not exists public.sw_hypothesis_log (
  id bigint generated always as identity not null,
  user_id uuid not null,
  chat_id uuid,
  at timestamptz not null default now(),
  candidates jsonb not null default '[]'::jsonb,   -- [{root_id, score, grades:[...], sources:[...]}] 그 턴의 후보
  chosen_root text,                                 -- 선택된 뿌리(없으면 null)
  chosen_by text not null default 'none',           -- user(카드·확인) | ai(분류) | discriminator(가르기 질문) | none
  outcome text,                                     -- 사용자 반응(나중에 채움): confirmed | partial | rejected | no_answer | corrected
  outcome_at timestamptz,
  model_version text,
  spec_version text,
  constraint sw_hypothesis_log_pkey primary key (id),
  constraint ck_sw_hypothesis_log_chosen_by check (chosen_by in ('user', 'ai', 'discriminator', 'none')),
  constraint ck_sw_hypothesis_log_outcome check (outcome is null or outcome in ('confirmed', 'partial', 'rejected', 'no_answer', 'corrected'))
);
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_user' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_user foreign key (user_id) references auth.users(id) on delete cascade;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_chat_id' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_chat_id foreign key (chat_id) references public.chat_sessions(session_id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_hypothesis_log_root' and conrelid = 'public.sw_hypothesis_log'::regclass) then
  alter table public.sw_hypothesis_log add constraint fk_sw_hypothesis_log_root foreign key (chosen_root) references public.sw_ob_roots(root_id);
end if; end $$;
create index if not exists ix_sw_hypothesis_log_user on public.sw_hypothesis_log (user_id, at);
alter table public.sw_hypothesis_log enable row level security;
revoke all on public.sw_hypothesis_log from anon, authenticated;
grant all on public.sw_hypothesis_log to service_role;

-- 삭제 함수 확장: 40의 sw_purge_user에 이 표를 더한다(그 외는 40과 같음)
create or replace function public.sw_purge_user(p_user uuid, p_include_human boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb := '{}'::jsonb; n int;
begin
  delete from public.sw_evidence_events where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_evidence_events', n);
  delete from public.sw_choice_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_choice_sessions', n);
  delete from public.sw_root_turn_log where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_root_turn_log', n);
  delete from public.sw_hypothesis_log where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_hypothesis_log', n);
  delete from public.sw_user_root_state where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_root_state', n);
  delete from public.sw_user_signals where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_user_signals', n);
  if p_include_human then
    delete from public.sw_hs_sessions where user_id = p_user; get diagnostics n = row_count; v := v || jsonb_build_object('sw_hs_sessions', n);   -- sw_hs_root_judgments·sw_hs_safety 연쇄
  end if;
  return v;   -- 지운 행 수(감사 기록용)
end $$;
revoke all on function public.sw_purge_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.sw_purge_user(uuid, boolean) to service_role;

