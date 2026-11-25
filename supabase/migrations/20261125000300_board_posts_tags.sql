-- 고민 타파 글 태그(최대 40개) — 2026-11-25 대표님: "관련된 태그 40개 걸어줘, 태그 눌렀을 때 관련된 글이 검색되게".
-- 관리자 화면에서 쓴 글의 태그를 저장한다. 앱에 넣어 둔 글(고민우체국 1~10화·고민 가이드 11편)의 태그는 코드(lib/board/tags.ts)에 있다.

begin;

alter table public.board_posts add column if not exists tags text[] not null default '{}';
alter table public.board_posts drop constraint if exists board_posts_tags_max;
alter table public.board_posts add constraint board_posts_tags_max check (cardinality(tags) <= 40);

notify pgrst, 'reload schema';

commit;
