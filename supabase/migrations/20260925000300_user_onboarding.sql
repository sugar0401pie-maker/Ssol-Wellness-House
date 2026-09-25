-- =====================================================================
-- SSOL Wellness House — migration: 새 9문항 온보딩 저장 테이블
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- 2026-09-25: SSOL_Onboarding_Development_Spec_v1_0 반영. 기존 profiles의
-- onboarding_completed_at/enjoyment_category/concern_domain/concern_other 컬럼은 그대로
-- 남겨둔다(과거 데이터 보존, 손 안 댐) — 이 새 테이블이 온보딩의 새 기준이 된다.
-- 스펙 5장의 필드 목록을 그대로 따른다. 기존 onboarding과 동일하게 app/api/onboarding
-- 라우트(서버, service_role)로만 읽고 쓴다 — 브라우저가 직접 접근하지 않으므로
-- counselor_inquiries와 같은 방식으로 service_role에만 권한을 준다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

create table if not exists public.user_onboarding (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  version                 text not null default '1.0.0',
  status                  text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  current_step            smallint not null default 0, -- 중간 이탈 후 재진입 시 이어서 보여줄 문항 index(0-8)

  relationship_status     text,
  dating_interest         text,
  relationship_stage      text,
  childcare_status        text,
  child_age_groups        text[],
  primary_activity        text,
  values_ranked           jsonb,   -- [{"key":"career_success","rank":1}, ...]
  hobbies_ranked          jsonb,
  weekends_ranked         jsonb,
  focus_domains           text[],
  daily_time              text,
  excluded_activities     text[],
  other_answers           jsonb,   -- {"relationship_status": "직접 입력한 텍스트", ...} 질문 id별 기타 텍스트

  personalization_consent boolean not null default false,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.user_onboarding is
  '2026-09-25 신설 9문항 온보딩(SSOL_Onboarding_Development_Spec_v1_0). 답변 미제공/건너뛴 문항은 null.';
comment on column public.user_onboarding.other_answers is
  '문항 id를 key로, 그 문항에서 "기타" 선택 시 입력한 자유 텍스트를 value로 저장. 순위형 문항의 기타 텍스트는 values_ranked/hobbies_ranked/weekends_ranked의 other_text 필드에 별도로 들어간다.';

drop trigger if exists user_onboarding_set_updated_at on public.user_onboarding;
create trigger user_onboarding_set_updated_at
  before update on public.user_onboarding
  for each row execute function public.set_updated_at();

alter table public.user_onboarding enable row level security;
revoke all on public.user_onboarding from anon, authenticated;
grant select, insert, update, delete on public.user_onboarding to service_role;

commit;
