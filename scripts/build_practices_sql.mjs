// wellness_practices.json → 마이그레이션 SQL 생성기.
// 원본 데이터는 owner가 만든 웰니스 실천방법 DB(375개 항목, domain x category x tier).
// 손으로 SQL을 고치지 말고, JSON이 바뀌면 이 스크립트를 다시 실행해서 새로 생성한다.
//
// 실행: node scripts/build_practices_sql.mjs <json 경로> > supabase/migrations/<날짜>_wellness_practices.sql
import { readFileSync } from "fs";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("사용법: node scripts/build_practices_sql.mjs <wellness_practices.json 경로>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const items = data.items;
if (!Array.isArray(items) || items.length === 0) {
  console.error("items가 비어있습니다.");
  process.exit(1);
}

function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const values = items
  .map(
    (it) =>
      `  (${sqlString(it.id)}, ${sqlString(it.domain)}, ${sqlString(it.category)}, ${sqlString(it.tier)}, ${sqlString(it.title)}, ${sqlString(it.detail)})`,
  )
  .join(",\n");

const sql = `-- =====================================================================
-- SSOL Wellness House — migration: 웰니스 실천방법 DB (wellness_practices)
-- (Supabase SQL Editor에 전체를 붙여넣고 Run)
--
-- owner가 만든 실천방법 DB(wellness_practices.json, ${items.length}개 항목)를 그대로 옮긴다.
-- domain(나 자신/인간관계/연인관계·부부생활/회사·커리어/육아) x category(몸으로 움직이기 등)
-- x tier(가볍게 시작/꾸준히 이어가기/장기 습관) 조합마다 여러 개의 구체적 실천 항목.
-- 채팅 답변에서 "지금 해볼 수 있는 것"을 제안할 때 이 목록을 우선 참고한다
-- (lib/rag/practicesSearch.ts). 자동 생성 파일 — scripts/build_practices_sql.mjs 로 재생성할 것,
-- 손으로 고치지 말 것. 서버 전용(브라우저 접근 불가) — 다른 지식 테이블과 동일하게 취급.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

begin;

create table if not exists public.wellness_practices (
  id         text primary key,
  domain     text not null,
  category   text not null,
  tier       text not null,
  title      text not null,
  detail     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists wellness_practices_set_updated_at on public.wellness_practices;
create trigger wellness_practices_set_updated_at
  before update on public.wellness_practices
  for each row execute function public.set_updated_at();

alter table public.wellness_practices enable row level security;
revoke all on public.wellness_practices from anon, authenticated;
grant select, insert, update, delete on public.wellness_practices to service_role;

insert into public.wellness_practices (id, domain, category, tier, title, detail) values
${values}
on conflict (id) do update set
  domain = excluded.domain, category = excluded.category, tier = excluded.tier,
  title = excluded.title, detail = excluded.detail, updated_at = now();

commit;
`;

process.stdout.write(sql);
