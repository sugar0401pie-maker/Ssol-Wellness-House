import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as CS from "@/lib/interp/vendor/case.mjs";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import { caseDataFromDb, personalDataFromDb } from "@/lib/interp/vendor/dbLoader.mjs";

// 과제 고르기 엔진 데이터(사례개념화 ssol_case · 개인 맞춤 ssol_personal)를 DB 표(sw_ob_*, CSO DB v5.24)에서 읽어 10분 둔다.
// 표 목록은 엔진 안내 v3.8~v3.17이 caseDataFromDb · personalDataFromDb에 넘기라고 한 것 그대로다. 여러 요청이 와도 한 번만 읽는다.
type Admin = ReturnType<typeof createAdminClient>;
const CASE_TABLES = [
  "sw_ob_scene_lens", "sw_ob_root_layers", "sw_ob_option_tags", "sw_ob_practice_flags", "sw_ob_stage_signals", "sw_ob_root_theory", "sw_ob_root_practices",
  "sw_ob_practice_area", "sw_ob_redirect_lines", "sw_ob_practice_theory", "sw_ob_scene_practices", "sw_ob_worry_practices",
] as const;
const PERSONAL_TABLES = [
  "sw_ob_practice_size", "sw_ob_scene_context", "sw_ob_root_practice_avoid", "sw_ob_roots", "sw_ob_practice_ref", "sw_ob_coping_questions", "sw_ob_practice_codes",
  "sw_ob_practice_ladder", "sw_ob_practice_alt", "sw_ob_plan_lexicon", "sw_ob_ctx_options", "sw_ob_root_predictions", "sw_ob_end_conditions",
  "sw_ob_condition_questions", "sw_ob_first_step_rules",
] as const;

async function rows(admin: Admin, table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

export type TaskEngineData = { titles: Record<string, string> };
let cache: { at: number; data: TaskEngineData } | null = null;
let loading: Promise<TaskEngineData> | null = null;

async function load(admin: Admin): Promise<TaskEngineData> {
  const names = [...new Set([...CASE_TABLES, ...PERSONAL_TABLES])];
  const got = await Promise.all(names.map((n) => rows(admin, n)));
  const t = Object.fromEntries(names.map((n, i) => [n, got[i]]));
  const caseData = caseDataFromDb(t);
  CS.setCaseData(caseData);
  const pd = PS.setPersonalData(personalDataFromDb(t), caseData as never) as { titles?: Record<string, string> };
  PS.setPracticeStages(caseData.practice_tags);
  const data = { titles: pd.titles ?? {} };
  cache = { at: Date.now(), data };
  return data;
}

export function loadTaskEngine(admin: Admin): Promise<TaskEngineData> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return Promise.resolve(cache.data);
  if (!loading) loading = load(admin).finally(() => { loading = null; });
  return loading;
}
