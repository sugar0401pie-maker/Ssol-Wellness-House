import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as RS from "./vendor/rootState.mjs";
import { buildBands, buildCues, buildTestInput, TEST_DOMAINS, TEST_PAIRS, type QuizRow } from "./testInput";

// 심리테스트(디저트 v2) 결과를 해석 장부에 근거 D등급으로 반영한다(2026-10-18, 로드맵 7번 — 테스트 단서).
// 대표 유형으로 정한 응시 기록(없으면 최신)을 쓰고, 재검사·대표 변경이면 이전 테스트 근거를 모두 대체한다(엔진 TRR-01·A-3).
// ssol_quiz_results는 다른 앱 소유라 읽기만 한다. 같은 결과를 다시 넣어도 장부는 바뀌지 않는다(멱등). 끄기: SW_TEST_CUES=0. 실패해도 채팅에는 영향 없음.
type Admin = ReturnType<typeof createAdminClient>;

let tbl: { at: number; cues: ReturnType<typeof buildCues>; bands: ReturnType<typeof buildBands> } | null = null;
async function loadTables(admin: Admin) {
  if (tbl && Date.now() - tbl.at < 10 * 60 * 1000) return tbl;
  const [c, b] = await Promise.all([
    admin.from("sw_ob_test_root_cues").select("cue_id,source,cond_json,root_id,points,direction,entry_hyps").limit(2000),
    admin.from("sw_ob_test_bands").select("band,lo,hi,label").limit(50),
  ]);
  if (c.error || b.error) throw new Error(`테스트 단서 표 읽기 실패: ${(c.error ?? b.error)?.code}`);
  tbl = { at: Date.now(), cues: buildCues(c.data ?? []), bands: buildBands(b.data ?? []) };
  return tbl;
}

const COLS = "id, type_key, factor_scores, sub_scores, created_at, user_id";
async function loadQuizRow(admin: Admin, userId: string): Promise<QuizRow | null> {
  const { data: profile } = await admin.from("profiles").select("primary_quiz_result_id").eq("user_id", userId).maybeSingle();
  if (profile?.primary_quiz_result_id) {
    const { data } = await admin.from("ssol_quiz_results").select(COLS).eq("id", profile.primary_quiz_result_id).maybeSingle();
    if (data && data.user_id === userId) return data; // 남의 것이면 무시하고 최신으로
  }
  const { data, error } = await admin.from("ssol_quiz_results").select(COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`ssol_quiz_results 조회 실패: ${error.code}`);
  return data ?? null;
}

const memo = new Map<string, string>(); // 같은 인스턴스에서 같은 결과를 반복해서 처리하지 않게(서버리스에서는 인스턴스마다 한 번)
export async function syncTestEvidence(admin: Admin, userId: string): Promise<void> {
  if (process.env.SW_TEST_CUES === "0") return;
  const row = await loadQuizRow(admin, userId);
  const test = buildTestInput(row);
  if (!test) return;
  const key = `${test.test_id}|${test.at ?? ""}`;
  if (memo.get(userId) === key) return;
  const t = await loadTables(admin);
  RS.setData({ testTable: { bands: t.bands, pairs: TEST_PAIRS, domains: TEST_DOMAINS, cues: t.cues } });
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  const states = RS.hydrate(userId, data ?? [], []);
  const sink: unknown[] = [];
  RS.applyTestCues(states, userId, test, t.cues, sink);
  if (sink.length) {
    const { error: oe } = await admin.rpc("sw_apply_ops", { p_user: userId, p_ops: sink });
    if (oe) throw new Error(`sw_apply_ops ${oe.code}`);
  }
  memo.set(userId, key);
}
