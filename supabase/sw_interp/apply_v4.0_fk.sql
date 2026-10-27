-- 쏘웰라 해석 DB v4.0 · 운영 표로 가는 연결(FK) — CSO 11번 + 검증 (2026-10-27)
-- 실행 전 확인(scripts/sw_fk_orphans.mjs, 읽기 전용): 실천·판별 문장 연결 6개는 끊긴 행 0 → 아래에서 validate 합니다.
-- 개념 연결 2개(sw_ob_root_concepts·sw_ob_node_concepts)는 운영 이론 개념 표에 없는 개념(PPT-C24·PPT-C25·RBT-C24·ST-C24·ST-C25·WBT-C24)을 가리키는 행이 있어
-- NOT VALID로만 붙이고 validate는 하지 않습니다(그 개념 행을 CSO에게 요청 — 받으면 개념을 넣은 뒤 validate).
-- 쏘웰라(sw) 해석 DB v4.0 · 11 운영 표로 가는 연결(FK)
-- ⚠ 신규 이론 6개·개념·신규 실천(RP 62·THX 107)·판별 문장 개념 v0.2를 운영에 먼저 넣은 뒤 실행 · 운영 표·열 이름은 개발 확인 후 맞춤
-- 재실행 안전: CREATE TABLE IF NOT EXISTS · 제약은 이름 붙여 없을 때만 추가
begin;

-- NOT VALID로 걸고(새 행부터 검사), 운영 데이터가 다 들어간 뒤 VALIDATE CONSTRAINT 실행
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_concepts_concept_id_ext' and conrelid = 'public.sw_ob_root_concepts'::regclass) then
  alter table public.sw_ob_root_concepts add constraint fk_sw_ob_root_concepts_concept_id_ext foreign key (concept_id) references public.theory_concepts(concept_id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_node_concepts_concept_id_ext' and conrelid = 'public.sw_ob_node_concepts'::regclass) then
  alter table public.sw_ob_node_concepts add constraint fk_sw_ob_node_concepts_concept_id_ext foreign key (concept_id) references public.theory_concepts(concept_id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_practices_practice_id_ext' and conrelid = 'public.sw_ob_root_practices'::regclass) then
  alter table public.sw_ob_root_practices add constraint fk_sw_ob_root_practices_practice_id_ext foreign key (practice_id) references public.wellness_practices(id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_root_practice_avoid_practice_id_ext' and conrelid = 'public.sw_ob_root_practice_avoid'::regclass) then
  alter table public.sw_ob_root_practice_avoid add constraint fk_sw_ob_root_practice_avoid_practice_id_ext foreign key (practice_id) references public.wellness_practices(id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_choice_practice_candidates_practice_id_ext' and conrelid = 'public.sw_ob_choice_practice_candidates'::regclass) then
  alter table public.sw_ob_choice_practice_candidates add constraint fk_sw_ob_choice_practice_candidates_practice_id_ext foreign key (practice_id) references public.wellness_practices(id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_signal_roots_signal_id_ext' and conrelid = 'public.sw_ob_signal_roots'::regclass) then
  alter table public.sw_ob_signal_roots add constraint fk_sw_ob_signal_roots_signal_id_ext foreign key (signal_id) references public.theory_signals(signal_id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_signal_unrooted_signal_id_ext' and conrelid = 'public.sw_ob_signal_unrooted'::regclass) then
  alter table public.sw_ob_signal_unrooted add constraint fk_sw_ob_signal_unrooted_signal_id_ext foreign key (signal_id) references public.theory_signals(signal_id) not valid;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_sw_ob_signal_review_signal_id_ext' and conrelid = 'public.sw_ob_signal_review'::regclass) then
  alter table public.sw_ob_signal_review add constraint fk_sw_ob_signal_review_signal_id_ext foreign key (signal_id) references public.theory_signals(signal_id) not valid;
end if; end $$;

commit;

-- 끊긴 행이 없는 6개 연결만 검증(validate)
begin;
alter table public.sw_ob_root_practices validate constraint fk_sw_ob_root_practices_practice_id_ext;
alter table public.sw_ob_root_practice_avoid validate constraint fk_sw_ob_root_practice_avoid_practice_id_ext;
alter table public.sw_ob_choice_practice_candidates validate constraint fk_sw_ob_choice_practice_candidates_practice_id_ext;
alter table public.sw_ob_signal_roots validate constraint fk_sw_ob_signal_roots_signal_id_ext;
alter table public.sw_ob_signal_unrooted validate constraint fk_sw_ob_signal_unrooted_signal_id_ext;
alter table public.sw_ob_signal_review validate constraint fk_sw_ob_signal_review_signal_id_ext;
commit;
