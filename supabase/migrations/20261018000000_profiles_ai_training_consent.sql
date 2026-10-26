-- 2026-10-18 owner 요청: 마이페이지 > 내 정보 확인 > 정보 수정에 "쏘웰라 AI 서비스 개선을 위한 모델 학습 활용 동의" 체크박스.
-- 기본은 동의(true) — 가입 때 약관·방침으로 동의한 것으로 보고, 마이페이지에서 언제든 해제(거부)할 수 있다.
-- 거부하면 해석 기능이 대화에서 뽑은 "사용자 말 조각"을 저장·활용하지 않는다(점수·제안은 그대로). 코드는 이 칸이 아직 없어도 동작한다(기본 동의로 본다).
alter table public.profiles add column if not exists ai_training_consent boolean not null default true;
alter table public.profiles add column if not exists ai_training_consent_at timestamptz;

comment on column public.profiles.ai_training_consent is
  '쏘웰라 AI 서비스 개선을 목적으로 개인정보·식별 데이터를 제외한 정보를 모델 학습에 활용하는 것에 대한 동의. 기본 true(약관 동의), 마이페이지에서 해제 가능. false면 대화 문장 조각을 저장·학습 활용하지 않는다.';
comment on column public.profiles.ai_training_consent_at is '학습 활용 동의 여부를 마지막으로 바꾼 시각(처음 값은 NULL).';
-- profiles에는 service_role 권한이 이미 있어 별도 GRANT가 필요 없다.
