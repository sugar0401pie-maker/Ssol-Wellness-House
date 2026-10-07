import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { RouteId } from "@/lib/safety/types";
import { generateShort } from "@/lib/ai/utilityModel";
import { buildSelectPrompt, parseTheoryAnswer } from "./theoryAnswer";

// 사용자의 최근 말을 보고 상담 이론 14개 중 가장 알맞은 하나를 고른다(없으면 null).
// 2026-10-06 측정으로 정한 방식: 판별 문장 임베딩 유사도만으로는 1등 정답률이 26%(상위 3개 안 64%)라 목표 정밀도(85~90%)에
// 못 미쳤고, 이론 한 줄 설명을 주고 AI가 하나 고르게 했더니 정답률 76%·고른 것의 정밀도 79%였다(scripts/theory_match_eval.mjs
// 참고). 그래서 이론 선택은 세션당 탐색을 시작할 때 한 번(필요하면 한 번 더) AI에 묻는다 — 입력 약 900토큰, 한 번에 약 0.3원.
// 모든 실패(테이블 없음, AI 장애, 알 수 없는 답)는 null = "이론 없이 일반 탐색"으로 처리한다(가장 안전한 쪽).
type TheoryRow = { theory_id: string; plain_focus: string; theory_axes: string | null; allowed_routes: string[]; clinical_sensitive: boolean };

let cache: { rows: TheoryRow[]; loadedAt: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

async function loadTheories(admin: ReturnType<typeof createAdminClient>): Promise<TheoryRow[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rows;
  const { data, error } = await admin
    .from("counseling_theories")
    .select("theory_id, plain_focus, theory_axes, allowed_routes, clinical_sensitive")
    .eq("review_status", "APPROVED")
    .order("theory_id");
  if (error || !data) {
    console.warn("이론 목록 조회 실패(마이그레이션 전일 수 있음):", error?.message);
    return cache?.rows ?? [];
  }
  cache = { rows: data as TheoryRow[], loadedAt: Date.now() };
  return cache.rows;
}

export async function selectTheory(
  admin: ReturnType<typeof createAdminClient>,
  params: { userMessages: string[]; route: RouteId },
): Promise<string | null> {
  const text = params.userMessages.slice(-3).join("\n").trim();
  if (!text) return null;
  try {
    const rows = (await loadTheories(admin)).filter((t) => !t.clinical_sensitive && t.allowed_routes.includes(params.route));
    if (!rows.length) return null;
    const ids = rows.map((t) => t.theory_id.replace("TH-", ""));
    const { text: answer } = await generateShort(
      buildSelectPrompt(rows.map((t) => ({ id: t.theory_id.replace("TH-", ""), focus: t.plain_focus, axes: t.theory_axes }))),
      text,
    );
    const id = parseTheoryAnswer(answer, ids);
    return id ? `TH-${id}` : null;
  } catch (e) {
    console.warn("이론 선택 실패, 이론 없이 일반 탐색:", e instanceof Error ? e.message : e);
    return null;
  }
}
