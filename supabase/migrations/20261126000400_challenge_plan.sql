-- 작심삼일 챌린지 계획 출처·내용 — 2026-11-26 대표님 + CSO 묶음 v2.40(엔진 ssol_challenge · 규칙 CH-01~06).
-- 대표님: 테스트(타로)에서 온 사람은 그 테스트가 준 챌린지 그대로, 그냥 온 사람은 질문 3개(가장 중요한 것·취미·주말) 답으로 엔진이 사람마다 고름(안 맞으면 셔플),
--         답이 없으면 지금처럼 세 가지 마음(걱정 줄이기·미루지 않기·기운 챙기기) 순서대로(셔플 가능).
-- source: theme(세 가지 마음) · engine(엔진이 고름) · tarot(타로가 준 다섯 칸). plan: 시작할 때의 3일·1주일·1달 글을 그대로 남김
-- (엔진 데이터가 나중에 바뀌어도 하던 챌린지 글이 바뀌지 않게). family_id: 엔진이 고른 활동 가족. 예전 챌린지는 theme·plan 없음 그대로.

begin;

alter table public.challenges add column if not exists source text not null default 'theme';
alter table public.challenges add column if not exists plan jsonb;
alter table public.challenges add column if not exists family_id text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_source_check') then
    alter table public.challenges add constraint challenges_source_check check (source in ('theme', 'engine', 'tarot'));
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
