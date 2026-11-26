-- 풍등 소원 글을 100자까지(대표님 2026-11-26: "40자가 너무 적고 글자가 풍등을 다 채우지 못해서 100자로").
-- 기존 제약(1~40자)을 지우고 1~100자로 다시 건다. 이미 저장된 소원은 모두 40자 이하라 그대로 통과한다.
-- 제약 이름을 몰라도 되게, wish 길이를 확인하는 제약을 찾아 지운다. 여러 번 실행해도 괜찮다.

begin;

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sky_lantern_wishes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%char_length(wish)%'
  loop
    execute format('alter table public.sky_lantern_wishes drop constraint %I', c);
  end loop;
end $$;

alter table public.sky_lantern_wishes
  add constraint sky_lantern_wishes_wish_len check (char_length(wish) between 1 and 100);

notify pgrst, 'reload schema';

commit;
