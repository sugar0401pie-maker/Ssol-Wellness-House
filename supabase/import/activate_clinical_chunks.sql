-- =====================================================================
-- ADHD·우울·공황 chunk 15개를 검색 대상으로 활성화 (사용자 결정, 2026-09-21)
-- 조건: 이 chunk를 사용한 답변에는 항상 전문가(정신건강의학과 등) 상담 안내를 함께 한다 (SAFE-007/009/010/011).
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- =====================================================================
update public.knowledge_chunks
set is_active = true
where article_id in ('SSOL-ADHD-001', 'SSOL-DEP-001', 'SSOL-PANIC-001');

-- 확인: 아래 결과에서 active = total(각 5)이면 성공. SELF004-A는 계속 비활성입니다.
select article_id,
       count(*) filter (where is_active) as active,
       count(*) as total
from public.knowledge_chunks
where article_id in ('SSOL-ADHD-001', 'SSOL-DEP-001', 'SSOL-PANIC-001')
group by article_id
order by article_id;
