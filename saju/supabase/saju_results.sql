-- 사주 결과 저장 테이블(초안 — 아직 실행하지 않음). 배포 전에 lib/store.ts를 이 테이블로 바꾼다.
-- 쏘웰라(app.ssolwellnesshouse.com)와 같은 Supabase 프로젝트에 만든다. 쏘웰라가 tarot_sessions를 읽듯
-- 로그인한 사용자의 최근 사주 결과에서 report->'challenge'(작심삼일 다섯 칸)를 읽어 챌린지를 시작한다.
-- 공유 프로젝트 규칙: 새 테이블은 service_role 권한이 자동으로 붙지 않으므로 GRANT를 꼭 적는다. ssol_* 객체는 건드리지 않는다.

create table if not exists public.saju_results (
  id uuid primary key,                              -- 결과 주소의 번호(/result/{id})
  user_id uuid references auth.users(id) on delete set null, -- 로그인 전 결과는 비어 있음 → 로그인하면 채움
  test_type text not null check (test_type in ('연애운','직장운','재물운','종합사주')),
  nickname text not null,
  worry_text text not null default '',
  report jsonb not null,                            -- 엔진 결과 전체 + challenge(쏘웰라로 넘기는 다섯 칸)
  safety_level text not null default 'none' check (safety_level in ('none','watch','urgent')),
  paid_at timestamptz,                              -- 토스 승인 확인 뒤에만 서버가 채운다
  created_at timestamptz not null default now()
);

create index if not exists saju_results_user_created on public.saju_results (user_id, created_at desc);

-- 브라우저에서 직접 읽고 쓰지 않는다(결제 전 유료 내용이 새지 않게 서버만 접근).
alter table public.saju_results enable row level security;
revoke all on public.saju_results from anon, authenticated;
grant select, insert, update on public.saju_results to service_role;

-- 결과 보관 기간·삭제 요청 처리는 쏘웰라 개인정보 처리방침과 맞춰 정한다(생년월일이 report 안에 들어 있음).
