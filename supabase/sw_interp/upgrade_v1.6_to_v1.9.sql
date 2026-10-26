-- 쏘웰라 해석 DB v1.6 → v1.9 제자리 업그레이드 (우리 쪽 작성 — CSO 원본 아님)
-- 이유: v1.9의 10번 파일은 `create table if not exists`만 써서, v1.6로 이미 만들어진 표에는 새 칸을 만들지 못한다. 그 상태로 실행하면
--   `column "status" does not exist`로 실패한다(2026-10-20 PGlite에서 확인). 그래서 새 칸·기본키 변경을 먼저 더한다.
-- 빈 DB(표가 아직 없음)에서도 안전하다: 표가 없으면 건너뛴다(그 표는 10번 파일이 새로 만든다). 여러 번 실행해도 안전하다.
do $$ begin
  if to_regclass('public.sw_ob_hypotheses') is not null then
    alter table public.sw_ob_hypotheses add column if not exists cue_basis text, add column if not exists cond_json jsonb, add column if not exists cond_chat_cues jsonb, add column if not exists cond_unknown jsonb, add column if not exists cond_note text;
  end if;
  if to_regclass('public.sw_ob_options') is not null then
    alter table public.sw_ob_options add column if not exists status text, add column if not exists parent_key text;
  end if;
  if to_regclass('public.sw_ob_questions') is not null then
    alter table public.sw_ob_questions add column if not exists cue_base numeric, add column if not exists cue_rank_factors text;
  end if;
  if to_regclass('public.sw_ob_test_root_cues') is not null then
    alter table public.sw_ob_test_root_cues add column if not exists instrument text, add column if not exists polarity text, add column if not exists note text;
    update public.sw_ob_test_root_cues set instrument = 'dessert_v2' where instrument is null;
  end if;
  if to_regclass('public.sw_ob_test_bands') is not null then
    alter table public.sw_ob_test_bands add column if not exists instrument text;
    update public.sw_ob_test_bands set instrument = 'dessert_v2' where instrument is null;
    alter table public.sw_ob_test_bands alter column instrument set not null;
    -- 기본키를 (band) → (instrument, band)로. 이미 바꿨으면 건너뛴다.
    if not exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
                    where c.conrelid = 'public.sw_ob_test_bands'::regclass and c.contype = 'p' and a.attname = 'instrument') then
      alter table public.sw_ob_test_bands drop constraint if exists sw_ob_test_bands_pkey;
      alter table public.sw_ob_test_bands add constraint sw_ob_test_bands_pkey primary key (instrument, band);
    end if;
  end if;
end $$;
