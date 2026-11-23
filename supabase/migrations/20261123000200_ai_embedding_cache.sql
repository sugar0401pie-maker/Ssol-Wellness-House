-- 임베딩 저장소 — 2026-11-23 대표님 승인(AI 비용 줄이기 1번). lib/ai/embedCache.ts가 쓴다.
-- 서버가 새로 켜질 때마다 고민 문장 색인(약 2,700문장)·해석 claim 색인을 OpenAI로 다시 바꾸던 비용을 없앤다. 한 번 바꾼 문장은 여기서 읽는다.
-- 넣는 것: 모델 이름 · 문장 지문(sha1 — 원문 아님) · 작게 줄인 벡터(1바이트 정수 1,536개를 base64로, 한 줄 약 2KB) · 배율. 사용자 글·개인정보는 넣지 않는다.
-- 서버(service_role)만 읽고 쓴다. 표가 없으면 예전처럼 매번 OpenAI로 바꾼다(결과는 같음).

create table if not exists public.ai_embedding_cache (
  model      text not null,
  text_hash  text not null,
  dims       integer not null check (dims > 0),
  scale      double precision not null check (scale > 0),
  q          text not null,
  created_at timestamptz not null default now(),
  primary key (model, text_hash)
);

alter table public.ai_embedding_cache enable row level security;
revoke all on public.ai_embedding_cache from anon, authenticated;
grant select, insert, update, delete on public.ai_embedding_cache to service_role;

notify pgrst, 'reload schema';
