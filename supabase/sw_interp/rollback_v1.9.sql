-- 쏘웰라 해석 DB v1.9 되돌리기 — apply_v1.9.sql이 만든 sw_ 표·뷰·함수만 지웁니다(기존 표·데이터·다른 앱 객체는 건드리지 않음)
-- 안전장치: 아래 목록 밖의 sw_ 객체가 이미 있으면 (다른 용도일 수 있으므로) 아무것도 지우지 않고 멈춥니다.
-- 주의: sw_ 표에 쌓인 데이터(근거 장부 등)도 함께 지워집니다. 필요하면 먼저 내려받으세요.
begin;
do $$
declare
  v_tables text[] := array['sw_choice_sessions', 'sw_evidence_events', 'sw_hs_root_judgments', 'sw_hs_safety', 'sw_hs_sessions', 'sw_hypothesis_log', 'sw_ob_astro_cue_hyps', 'sw_ob_astro_cues', 'sw_ob_astro_greetings', 'sw_ob_astro_sign_element', 'sw_ob_astro_statements', 'sw_ob_astro_terms', 'sw_ob_choice_cards', 'sw_ob_choice_cards_fixed', 'sw_ob_choice_confirm', 'sw_ob_choice_options', 'sw_ob_choice_practice_candidates', 'sw_ob_choice_regression', 'sw_ob_choice_scenes', 'sw_ob_claim_roots', 'sw_ob_claims', 'sw_ob_combos', 'sw_ob_context_rules', 'sw_ob_context_use', 'sw_ob_ctx_guards', 'sw_ob_ctx_options', 'sw_ob_ctx_questions', 'sw_ob_ctx_root_modifiers', 'sw_ob_ctx_updates', 'sw_ob_dessert_types', 'sw_ob_escalate_signals', 'sw_ob_eval_set', 'sw_ob_evidence_grades', 'sw_ob_hs_fields', 'sw_ob_hs_prebrief', 'sw_ob_human_phrases', 'sw_ob_hypotheses', 'sw_ob_ladder_questions', 'sw_ob_leaves', 'sw_ob_no_split', 'sw_ob_node_concepts', 'sw_ob_node_fixes', 'sw_ob_node_marks', 'sw_ob_node_polarity', 'sw_ob_option_groups', 'sw_ob_options', 'sw_ob_questions', 'sw_ob_root_concepts', 'sw_ob_root_discriminators', 'sw_ob_root_practice_avoid', 'sw_ob_root_practice_coverage', 'sw_ob_root_practices', 'sw_ob_root_review_flags', 'sw_ob_root_texts', 'sw_ob_root_theory', 'sw_ob_roots', 'sw_ob_rules', 'sw_ob_safety_signals', 'sw_ob_scene_links', 'sw_ob_scenes', 'sw_ob_signal_drafts', 'sw_ob_signal_roots', 'sw_ob_signal_unrooted', 'sw_ob_state_slots', 'sw_ob_submotives', 'sw_ob_test_bands', 'sw_ob_test_domains', 'sw_ob_test_root_cues', 'sw_ob_test_root_pairs', 'sw_root_turn_log', 'sw_user_root_state', 'sw_user_signals'];
  v_views  text[] := array['sw_ob_option_axes', 'sw_user_last_activity'];
  v_funcs  text[] := array['sw_apply_evidence', 'sw_apply_ops', 'sw_purge_inactive', 'sw_purge_user', 'sw_read_ledger', 'sw_recompute_root', 'sw_set_root_status', 'sw_supersede_event'];
  x record; extra text := '';
begin
  -- 1) 목록 밖 sw_ 객체 점검
  for x in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname like 'sw\_%' and c.relkind in ('r','v','m','p')
              and c.relname <> all (v_tables || v_views) loop
    extra := extra || ' 표/뷰:' || x.relname;
  end loop;
  for x in select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'sw\_%' and p.proname <> all (v_funcs) loop
    extra := extra || ' 함수:' || x.proname;
  end loop;
  if extra <> '' then raise exception '목록에 없는 sw_ 객체가 있어 멈춥니다:%', extra; end if;
  -- 2) 지우기: 뷰 → 함수 → 표(CASCADE는 이 표들을 가리키는 연결 제약만 함께 지움)
  for x in select unnest(v_views) as n loop execute format('drop view if exists public.%I', x.n); end loop;
  for x in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (v_funcs) loop execute format('drop function if exists %s', x.sig); end loop;
  for x in select unnest(v_tables) as n loop execute format('drop table if exists public.%I cascade', x.n); end loop;
  raise notice '되돌리기 완료: 표 %개, 뷰 %개, 함수 %개를 정리했습니다', array_length(v_tables,1), array_length(v_views,1), array_length(v_funcs,1);
end $$;
notify pgrst, 'reload schema';
commit;
