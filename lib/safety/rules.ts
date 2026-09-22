import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SafetyRule = {
  rule_id: string;
  category: string;
  trigger: string[];
  rule_text: string;
  priority: string;
  handoff_action: string | null;
};

export type ResponseRoute = {
  route_order: number;
  intent_or_trigger: string;
  required_policy: string[];
  retrieval_scope: string;
  top_k: number | null;
  forbidden: string[] | null;
  notes: string | null;
};

type Cache = { rules: SafetyRule[]; routes: ResponseRoute[]; loadedAt: number };
let cache: Cache | null = null;
const TTL_MS = 5 * 60 * 1000; // 5분 캐시. 관리자가 safety_rules를 고치면 최대 5분 내 반영됨.

// DB 전체가 응답하지 않을 때(예: Supabase 장애)의 최후 안전망.
// SAFE-013(자살/자해), SAFE-001(폭력)만 담는다. 그 외 route는 DB 없이는 판단하지 않는다.
const FALLBACK_RULES: SafetyRule[] = [
  {
    rule_id: "SAFE-013",
    category: "fallback",
    trigger: ["죽고 싶다", "자살", "자해", "살 이유가 없다", "생을 마감", "해치고 싶다"],
    rule_text: "",
    priority: "Critical",
    handoff_action: null,
  },
  {
    rule_id: "SAFE-001",
    category: "fallback",
    trigger: ["신체적 폭력", "성적 강요", "협박", "스토킹", "지속적 모욕/위협", "경제적/사회적 통제"],
    rule_text: "",
    priority: "Critical",
    handoff_action: null,
  },
];

export async function getSafetyData(): Promise<Cache> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;

  try {
    const admin = createAdminClient();
    const [rulesRes, routesRes] = await Promise.all([
      admin.from("safety_rules").select("rule_id,category,trigger,rule_text,priority,handoff_action"),
      admin
        .from("response_routes")
        .select("route_order,intent_or_trigger,required_policy,retrieval_scope,top_k,forbidden,notes")
        .order("route_order"),
    ]);
    if (rulesRes.error) throw rulesRes.error;
    if (routesRes.error) throw routesRes.error;

    cache = { rules: rulesRes.data ?? [], routes: routesRes.data ?? [], loadedAt: Date.now() };
    return cache;
  } catch (e) {
    console.error("safety_rules/response_routes 조회 실패, 폴백 사용:", e instanceof Error ? e.message : e);
    // 오래됐어도 이전에 불러온 캐시가 있으면 그걸 계속 쓰고, 전혀 없으면 최소 안전망만 쓴다.
    if (cache) return cache;
    return { rules: FALLBACK_RULES, routes: [], loadedAt: 0 };
  }
}
