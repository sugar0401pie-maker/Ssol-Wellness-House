-- 2026-10-17 owner 요청: 채팅 무료체험(3일/7일)을 "계정이 만들어진 날"이 아니라 "쏘웰라에 처음 직접 들어온 날"부터 센다.
-- 이유: 이 프로젝트의 로그인 계정은 점성술·심리테스트 등 다른 앱과 공유라, 다른 곳에서 계정만 만들어도 profiles 행이
-- 자동 생성되어 쏘웰라를 한 번도 안 열어봤는데 체험 기간이 흘러가 버렸다.
--
-- trial_started_at: 쏘웰라 서버가 그 사용자의 첫 요청(로그인한 실제 계정)을 받은 시각. NULL이면 아직 안 들어온 것.
-- 값은 코드(lib/billing/loadAccess.ts)가 첫 접속 때 한 번만 채운다(이미 값이 있으면 절대 덮어쓰지 않음).
alter table public.profiles add column if not exists trial_started_at timestamptz;

comment on column public.profiles.trial_started_at is
  '쏘웰라 채팅 무료체험 시작 시각(= 쏘웰라에 처음 직접 로그인해 들어온 시각). NULL이면 아직 쏘웰라에 들어오지 않음. 코드가 첫 접속 때 한 번만 기록한다.';

-- 이미 쏘웰라를 써 본 흔적이 있는 사람(온보딩 시작·채팅 기록·약관 동의·온보딩 완료)은 기존 가입일 그대로 유지 —
-- 이미 진행 중인 체험 일정이 바뀌지 않게 한다. 흔적이 없는 사람은 NULL로 남겨 첫 접속일부터 시작하게 한다.
update public.profiles p
set trial_started_at = p.created_at
where p.trial_started_at is null
  and (
    exists (select 1 from public.user_onboarding o where o.user_id = p.user_id)
    or exists (select 1 from public.chat_sessions c where c.user_id = p.user_id)
    or p.terms_agreed_at is not null
    or p.onboarding_completed_at is not null
  );

-- service_role(서버)은 이미 profiles 전체 권한이 있어 별도 GRANT가 필요 없다.
