import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import * as LD from "./vendor/dbLoader.mjs";
import { buildHandoff } from "./astroInput";

// 점성술 결과를 해석 장부에 근거로 반영한다(2026-10-20, 로드맵 7번 — 점성술 단서). 엔진 applyAstro(AR-01·02):
// 답 Q1~Q3은 근거 D(출처별 뿌리당 최대 2.0), 유형·태양 별자리 같은 자동 판정 성향 문장은 F+(뿌리당 최대 1.0). 다시 하면 이전 점성술 근거를 대체한다.
// astro_results는 점성술 앱 소유라 읽기만 한다. 가장 최근 결과를 쓴다. 끄기: SW_ASTRO_CUES=0. 실패해도 채팅에는 영향 없음.
// 채팅에 점성술 전용 말(별자리 이름 등)을 직접 쓰지 않는 제한은 그대로다(이 모듈은 점수만 만든다 — 사용자에게 가는 문장은 뿌리 문장 DB).
type Admin = ReturnType<typeof createAdminClient>;

let cache: { at: number } | null = null;
async function loadAstroData(admin: Admin) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return;
  const t: Record<string, unknown[]> = {};
  for (const name of ["sw_ob_astro_cues", "sw_ob_astro_cue_hyps", "sw_ob_astro_sign_element", "sw_ob_astro_statements"]) {
    const out: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(name).select("*").range(from, from + 999);
      if (error) throw new Error(`${name} 읽기 실패: ${error.code}`);
      out.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    t[name] = out;
  }
  RS.setData({ astroCues: LD.astroCuesFromDb(t as never), astroStatements: LD.astroStatementsFromDb(t as never) }); // 벤더 JS의 추론 타입이 표 이름 키를 요구해 형태만 맞춰 넘긴다
  cache = { at: Date.now() };
}

const memo = new Map<string, string>();
export async function syncAstroEvidence(admin: Admin, userId: string): Promise<void> {
  if (process.env.SW_ASTRO_CUES === "0") return;
  const { data: row, error } = await admin
    .from("astro_results")
    .select("id, created_at, answers, competency, style, sun_sign, accuracy")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { if (error.code !== "42P01" && error.code !== "PGRST205") throw new Error(`astro_results 조회 ${error.code}`); return; } // 표가 없으면(점성술 앱 쪽 준비 전) 조용히 건너뜀
  const h = buildHandoff(row);
  const key = h ? `${h.source_id}|${h.created_at}` : "none";
  if (memo.get(userId) === key) return;
  if (!h) { memo.set(userId, key); return; } // 점성술 결과가 없으면 할 일 없음(이전 점성술 근거가 있다면 그대로 둠 — 결과 삭제는 별도 흐름)

  await loadAstroData(admin);
  const { data: ledger, error: le } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (le) throw new Error(`sw_read_ledger ${le.code}`);
  const states = RS.hydrate(userId, ledger ?? [], []);
  const sink: unknown[] = [];
  RS.applyAstro(states, userId, h as never, sink as never);
  if (sink.length) {
    const { error: oe } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
    if (oe) throw new Error(`sw_apply_ops ${oe.code}`);
  }
  memo.set(userId, key);
}
