import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import { interpListed } from "./listed";
import { loadData } from "./hypothesis";
import type { RootBoostFn } from "./rootBoostApply";

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
    if (!Object.values(states).some((s) => s.status === "confirmed" || s.status === "likely")) return null; // 가산할 근거가 없으면 표를 읽지도 않는다
    const t = await tables(admin);
    const ctx = { enabled: true, avoid: t.avoid, sensitiveRoots: t.sensitive };
    return (practiceId) => {
      const r = RS.rootBoost({ id: practiceId, roots: t.roots.get(practiceId) ?? [] }, states, ctx);
      return { boost: r.boost, exclude: r.exclude };
    };
  } catch (e) {
    console.warn("뿌리 가산 준비 실패, 가산 없이 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}
