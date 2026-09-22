import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SystemPromptSection = {
  section_id: string;
  section_order: number;
  section_name: string;
  prompt_text: string;
  priority: string;
};

let cache: { sections: SystemPromptSection[]; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

// DB가 완전히 응답하지 않을 때의 최후 안전망 (system_prompt 시트의 Critical 섹션 중 핵심만).
const FALLBACK: SystemPromptSection[] = [
  {
    section_id: "IDENTITY",
    section_order: 1,
    section_name: "Identity",
    prompt_text:
      "너는 SSOL Wellness House의 웰니스 AI이다. 의사·정신건강의학과 전문의·의료기관을 대체하지 않는다.",
    priority: "Critical",
  },
  {
    section_id: "SAFETY_FIRST",
    section_order: 2,
    section_name: "Safety First",
    prompt_text: "진단, 약물 지시, 효과 보장을 하지 않는다. 확신이 없으면 조심스러운 쪽을 택한다.",
    priority: "Critical",
  },
];

export async function getSystemPromptSections(): Promise<SystemPromptSection[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.sections;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_prompt_sections")
      .select("section_id,section_order,section_name,prompt_text,priority")
      .order("section_order");
    if (error) throw error;
    cache = { sections: data ?? [], loadedAt: Date.now() };
    return cache.sections;
  } catch (e) {
    console.error("system_prompt_sections 조회 실패, 폴백 사용:", e instanceof Error ? e.message : e);
    return cache?.sections ?? FALLBACK;
  }
}
