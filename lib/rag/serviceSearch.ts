import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// route 7(SSOL 서비스 문의)용. service_knowledge/brand_knowledge/programs는 22행뿐이라
// 별도 임베딩을 만들지 않고, 2글자 조각(글자 bigram) 겹침으로 가볍게 관련도를 매긴다.
// 한국어 형태소 분석기 없이도 "웰니스 세션이 뭐예요"와 "웰니스 세션 정의" 같은 표현을 매칭할 수 있다.

export type ServiceResult = {
  kind: "service" | "brand" | "program";
  id: string;
  title: string;
  text: string; // 공식 문구 (official_ai_statement / official_text+ai_interpretation / core_principle)
  clinicalBoundary?: string | null;
  doNot?: string | null;
};

function bigrams(text: string): Set<string> {
  const clean = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export async function searchServiceKnowledge(message: string): Promise<ServiceResult[]> {
  const admin = createAdminClient();
  const [svc, brand, programs] = await Promise.all([
    admin.from("service_knowledge").select("service_id,service_topic,official_ai_statement,clinical_boundary,do_not"),
    admin.from("brand_knowledge").select("brand_id,concept,official_text,ai_interpretation,do_not"),
    admin.from("programs").select("program_id,program_name,core_principle,do_not").eq("active", true),
  ]);

  const items: (ServiceResult & { searchText: string })[] = [
    ...(svc.data ?? []).map((r) => ({
      kind: "service" as const,
      id: r.service_id,
      title: r.service_topic,
      text: r.official_ai_statement,
      clinicalBoundary: r.clinical_boundary,
      doNot: r.do_not,
      searchText: `${r.service_topic} ${r.official_ai_statement}`,
    })),
    ...(brand.data ?? []).map((r) => ({
      kind: "brand" as const,
      id: r.brand_id,
      title: r.concept,
      text: `${r.official_text} — ${r.ai_interpretation}`,
      doNot: r.do_not,
      searchText: `${r.concept} ${r.official_text} ${r.ai_interpretation}`,
    })),
    ...(programs.data ?? []).map((r) => ({
      kind: "program" as const,
      id: r.program_id,
      title: r.program_name,
      text: r.core_principle,
      doNot: Array.isArray(r.do_not) ? r.do_not.join(" / ") : r.do_not,
      searchText: `${r.program_name} ${r.core_principle}`,
    })),
  ];

  const qBigrams = bigrams(message);
  const scored = items
    .map((it) => ({ ...it, score: overlapScore(qBigrams, bigrams(it.searchText)) }))
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).slice(0, 5);
  if (top.length > 0) return top;

  // 아무것도 안 걸리면(표현이 많이 달라서) "SSOL이 뭔가요" 류의 기본 안내로 대체한다.
  return scored.filter((s) => ["SERVICE-CORE-001", "SERVICE-CORE-002", "BRAND-001"].includes(s.id));
}
