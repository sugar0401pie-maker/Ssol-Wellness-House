import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as PS from "@/lib/interp/vendor/personal.mjs";
import { outcomeStatsFromRows } from "@/lib/interp/vendor/dbLoader.mjs";

// 주간 집계(CSO 통합 회신 26·28항 — 주 1회 sw_stats_practice_refresh · sw_stats_hypothesis_refresh, 뿌리 근거 sw_stats_refresh)와
// 사람들 전체 결과(PS.setOutcomeStats — 확인 답 30건 이상인 실천만 ±0.3 안에서 조정, 엔진 안내 v3.11 ④). 2026-11-20 3부-5.
// 예약 작업에 기대지 않고, 과제 엔진 데이터를 올릴 때(10분 캐시) 집계가 7일 넘게 묵었으면 서버가 직접 새로 고친다 — 인스턴스마다 6시간에 한 번만 시도.
// 집계 표에는 사용자 id가 없다(실천·뿌리·주별 개수만). 실패해도 과제 고르기는 집계 없이 그대로 돈다.
type Admin = ReturnType<typeof createAdminClient>;
const STALE_MS = 7 * 24 * 3600 * 1000, RETRY_MS = 6 * 3600 * 1000, WEEKS = 8;
let lastTry = 0;

export async function refreshStatsIfStale(admin: Admin, now = Date.now()): Promise<boolean> {
  if (now - lastTry < RETRY_MS) return false;
  lastTry = now;
  const { data, error } = await admin.from("sw_stats_practice_weekly").select("refreshed_at").order("refreshed_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return false;
  const at = data?.refreshed_at ? new Date(String(data.refreshed_at)).getTime() : 0;
  if (now - at < STALE_MS) return false;
  for (const fn of ["sw_stats_practice_refresh", "sw_stats_hypothesis_refresh", "sw_stats_refresh"]) {
    const { error: e } = await admin.rpc(fn, { p_weeks: WEEKS });
    if (e) console.warn("주간 집계 새로 고침 실패:", fn, e.code);
  }
  return true;
}

// 집계 표 → 엔진(실천별 전체 결과). 표본이 모자란 실천은 엔진이 조정하지 않는다.
export async function loadOutcomeStats(admin: Admin): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("sw_stats_practice_weekly").select("practice_id, checked, improved").range(from, from + 999);
    if (error) return 0;
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  const stats = outcomeStatsFromRows(rows as never) as unknown[];
  PS.setOutcomeStats(stats as never);
  return stats.length;
}
