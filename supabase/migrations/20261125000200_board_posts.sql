-- 고민 타파 글(고민 가이드·고민우체국) — 2026-11-25 대표님: "네가 게시판 만들어주면 거기에 올릴 거여".
-- 관리자 화면(/admin)에서 쓰고 고치면, 로그인 없이 보는 공개 게시판(/board)과 앱 안 고민 타파(/worry)에 그대로 보인다.
-- kind='guide'는 slug(주소 이름)로, kind='post'(고민우체국)는 n(회차)로 구분한다. 지우지 않고 published=false로 숨긴다.
-- 서버(service_role)만 읽고 쓴다(공개 화면도 서버가 읽어 그린다).

begin;

create table if not exists public.board_posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('guide', 'post')),
  slug        text,                                       -- guide: 영어 소문자·숫자·하이픈(예: is-this-ssom)
  n           integer,                                    -- post: 회차(1, 2, 3 …)
  tag         text not null check (char_length(tag) between 1 and 20),
  title       text not null check (char_length(title) between 1 and 120),
  lines       text[] not null default '{}',               -- guide: 먼저 한 줄로(3줄)
  summary     text,                                       -- post: 줄거리
  body        text not null default '',                   -- 본문(간단한 서식: ## 소제목, - 목록, **굵게**)
  image       text,                                       -- post: 표지 그림 주소(없으면 앱에 넣어 둔 그림)
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((kind = 'guide' and slug is not null and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') or (kind = 'post' and n is not null and n > 0))
);
create unique index if not exists board_posts_guide_slug_uidx on public.board_posts (slug) where kind = 'guide';
create unique index if not exists board_posts_post_n_uidx on public.board_posts (n) where kind = 'post';

alter table public.board_posts enable row level security;
revoke all on public.board_posts from anon, authenticated;
grant select, insert, update, delete on public.board_posts to service_role;

notify pgrst, 'reload schema';

commit;
