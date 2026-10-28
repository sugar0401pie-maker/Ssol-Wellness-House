import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import { interpListed } from "./listed";
import { loadData } from "./hypothesis";
import type { RootBoostFn } from "./rootBoostApply";
import { cautionHoldRoots } from "./deepeningFlow";
import { loadPracticeFlags } from "./practiceFlags";
import { growthReport } from "./growth";
import { latestMotivePosition } from "./growthPure";

// 사용자의 해석 상태(확인·가능성 높은 뿌리)로 채팅 실천 제안 순서를 조정한다(2026-10-18, 로드맵 6번).
// 뿌리↔실천 표(sw_ob_root_practices)와 "맞지 않는 실천"(sw_ob_root_practice_avoid)은 10분 캐시. 끄기: SW_ROOT_BOOST=0.
// 어떤 실패도 제안에는 영향이 없다(가산 없이 이전처럼 고른다). 민감 표시 뿌리는 가산하지 않는다(엔진 RC-10, 사용자가 말했는지 알 수 없어 보수적으로).
type Admin = ReturnType<typeof createAdminClient>;
let cache: { at: number; roots: Map<string, string[]>; avoid: Set<string>; sensitive: Set<string> } | null = null;

async function page<T>(admin: Admin, table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).order(cols.split(",")[0]).range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
    out.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

async function tables(admin: Admin) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache;
  const [rp, av, { texts }] = await Promise.all([
    page<{ root_id: string; practice_id: string }>(admin, "sw_ob_root_practices", "root_id,practice_id"),
    page<{ root_id: string; practice_id: string }>(admin, "sw_ob_root_practice_avoid", "root_id,practice_id"),
    loadData(admin),
  ]);
  const roots = new Map<string, string[]>();
  for (const x of rp) (roots.get(x.practice_id) ?? roots.set(x.practice_id, []).get(x.practice_id)!).push(x.root_id);
  cache = { at: Date.now(), roots, avoid: new Set(av.map((x) => `${x.root_id}|${x.practice_id}`)), sensitive: new Set(Object.values(texts).filter((t) => t.sensitive).map((t) => t.root_id)) };
  return cache;
}

export async function loadRootBoost(admin: Admin, userId: string): Promise<RootBoostFn | null> {
  try {
    if (process.env.SW_ROOT_BOOST === "0" || !(await interpListed(admin, userId))) return null;
    const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
    if (error) return null;
    const states = RS.hydrate(userId, data ?? [], []);
    const hold = await cautionHoldRoots(admin, userId); // 깊어짐(③)으로 주의 표시가 켜진 뿌리 — 그 뿌리 관련 "불편 머무르기" 실천은 뺀다(나아짐 신호가 나오면 풀림)
    // 성장 방향·동기 위치(CSO 제1장): 나를 넘어섬 신호가 있으면 지친 상태에서도 그 방향 실천을 빼지 않고(DIR-06), 최근 동기 위치에 맞는 실천에 +0.5(MV-03).
    const growth = await growthReport(admin, userId);
    const motivePosition = latestMotivePosition(growth.signals);
    if (!hold.size && !motivePosition && !Object.values(states).some((s) => s.status === "confirmed" || s.status === "likely")) return null; // 가산할 근거가 없으면 표를 읽지도 않는다
    const [t, flags] = await Promise.all([tables(admin), loadPracticeFlags(admin)]);
    const ctx = { enabled: true, avoid: t.avoid, sensitiveRoots: t.sensitive, beyondSignal: growth.beyond, motivePosition };
    return (practiceId, exposureStep, tier) => {
      const roots = t.roots.get(practiceId) ?? [];
      if (exposureStep && roots.some((r) => hold.has(r))) return { boost: 0, exclude: true };
      const f = flags[practiceId] ?? {};
      // step·exposure_step·beyond_self는 엔진의 속도·부담 거르기(③-10 몸 단계 · RC-19 지친 상태)가 본다. 표시가 없으면 걸리지 않는다.
      const r = RS.rootBoost({ id: practiceId, roots, step: tier ?? undefined, exposure_step: exposureStep ?? undefined, beyond_self: f.beyond_self, motive_fit: f.motive_fit }, states, ctx);
      return { boost: r.boost, exclude: r.exclude };
    };
  } catch (e) {
    console.warn("뿌리 가산 준비 실패, 가산 없이 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}
