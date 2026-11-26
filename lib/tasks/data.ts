import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import * as RS from "@/lib/interp/vendor/rootState.mjs";
import * as CH from "@/lib/interp/vendor/challenge.mjs";
import { caseDataFromDb, challengeDataFromDb, discriminatorsFromDb, personalDataFromDb } from "@/lib/interp/vendor/dbLoader.mjs";
import { releaseInSession } from "./flow";
import { loadOutcomeStats, refreshStatsIfStale } from "./stats";

// 과제 고르기 엔진 데이터(사례개념화 ssol_case · 개인 맞춤 ssol_personal · 작심삼일 ssol_challenge)를 DB 표(sw_ob_*, CSO DB v5.40)에서 읽어 10분 둔다.
// 표 목록은 엔진 안내 v3.8~v3.17이 caseDataFromDb · personalDataFromDb에 넘기라고 한 것 그대로다. 여러 요청이 와도 한 번만 읽는다.
type Admin = ReturnType<typeof createAdminClient>;
const CASE_TABLES = [
  "sw_ob_scene_lens", "sw_ob_root_layers", "sw_ob_option_tags", "sw_ob_practice_flags", "sw_ob_stage_signals", "sw_ob_root_theory", "sw_ob_root_practices",
  "sw_ob_practice_area", "sw_ob_redirect_lines", "sw_ob_practice_theory", "sw_ob_scene_practices", "sw_ob_worry_practices",
  "sw_ob_root_causes", "sw_ob_sub_branches", "sw_ob_sub_branch_roots", // v2.32(DB v5.32 · 엔진 v3.31): 결과형 → 원인 뿌리 · 갈래 → 뿌리(과제가 갈래를 봄)
] as const;
const PERSONAL_TABLES = [
  "sw_ob_practice_size", "sw_ob_scene_context", "sw_ob_root_practice_avoid", "sw_ob_roots", "sw_ob_practice_ref", "sw_ob_coping_questions", "sw_ob_practice_codes",
  "sw_ob_practice_ladder", "sw_ob_practice_alt", "sw_ob_plan_lexicon", "sw_ob_ctx_options", "sw_ob_root_predictions", "sw_ob_end_conditions",
  "sw_ob_condition_questions", "sw_ob_first_step_rules",
  "sw_ob_root_discriminators", // 3부-4: 겨루는 가설의 가르는 질문(RS.discriminatorFor)
] as const;
// 2026-11-26(CSO 묶음 v2.40 · 엔진 v3.39): 작심삼일 과제(ssol_challenge)와 오늘의 제안(ssol_daily)이 읽는 표 — challengeDataFromDb에 넘기라고 한 것 그대로
// (practice_ref · practice_size는 위 PERSONAL_TABLES에 이미 있음).
const CHALLENGE_TABLES = ["sw_ob_activity_families", "sw_ob_challenge_review", "sw_ob_root_pairs", "sw_ob_activity_prefs", "sw_ob_interest_subs", "sw_ob_options"] as const;

async function rows(admin: Admin, table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

export type TaskEngineData = { titles: Record<string, string>; caseData: ReturnType<typeof caseDataFromDb> };
let cache: { at: number; data: TaskEngineData } | null = null;
let loading: Promise<TaskEngineData> | null = null;

async function load(admin: Admin): Promise<TaskEngineData> {
  const names = [...new Set([...CASE_TABLES, ...PERSONAL_TABLES, ...CHALLENGE_TABLES])];
  const got = await Promise.all(names.map((n) => rows(admin, n)));
  const t = Object.fromEntries(names.map((n, i) => [n, got[i]]));
  const caseData = caseDataFromDb(t);
  CS.setCaseData(caseData);
  const raw = personalDataFromDb(t) as ReturnType<typeof personalDataFromDb> & { review: Record<string, string | null>; in_session: string[] };
  releaseInSession(raw);
  const pd = PS.setPersonalData(raw, caseData as never) as { titles?: Record<string, string> };
  PS.setPracticeStages(caseData.practice_tags);
  RS.setData({ discriminators: discriminatorsFromDb(t as never) }); // 가르는 질문 105묶음(다른 RS 데이터는 그대로 둔다)
  CH.setChallengeData(challengeDataFromDb(t as never)); // 활동 가족 · 3일차 돌아보기 · 반대 짝 · 온보딩 답 → 활동 · 관심 분야 → 세부 고민
  // 3부-5: 주간 집계가 묵었으면 새로 고치고, 사람들 전체 결과를 엔진에 넘긴다(실패해도 그대로 진행).
  await refreshStatsIfStale(admin).catch(() => false);
  await loadOutcomeStats(admin).catch(() => 0);
  const data = { titles: pd.titles ?? {}, caseData };
  cache = { at: Date.now(), data };
  return data;
}

export function loadTaskEngine(admin: Admin): Promise<TaskEngineData> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return Promise.resolve(cache.data);
  if (!loading) loading = load(admin).finally(() => { loading = null; });
  return loading;
}
