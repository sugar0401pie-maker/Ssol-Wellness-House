import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { practiceFlagsFromDb } from "./vendor/dbLoader.mjs";

// 실천 표시(sw_ob_practice_flags, DB v4.5 · CSO 제1장): 나를 넘어서는 실천(beyond_self) · 용기 연습 제안 이유(courage_why) · 갈래(path·path2) · 동기 위치 궁합(motive_fit).
// 10분 캐시. 표가 아직 없거나 읽기에 실패하면 빈 표를 돌려준다 — 표시가 없으면 거르기·가산이 걸리지 않을 뿐 제안은 예전처럼 나간다.
type Admin = ReturnType<typeof createAdminClient>;
export type PracticeFlag = { beyond_self?: boolean; courage_why?: string; path?: string; path2?: string; motive_fit?: string[] };
let cache: { at: number; flags: Record<string, PracticeFlag> } | null = null;

export async function loadPracticeFlags(admin: Admin): Promise<Record<string, PracticeFlag>> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.flags;
  const rows: { practice_id: string; flag: string; value: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("sw_ob_practice_flags").select("practice_id,flag,value").order("practice_id").range(from, from + 999);
    if (error) return cache?.flags ?? {}; // 표가 없음(v4.5 SQL 전) 등 — 표시 없이 진행
    rows.push(...((data ?? []) as typeof rows));
    if ((data?.length ?? 0) < 1000) break;
  }
  const flags = practiceFlagsFromDb({ sw_ob_practice_flags: rows }) as Record<string, PracticeFlag>;
  cache = { at: Date.now(), flags };
  return flags;
}
