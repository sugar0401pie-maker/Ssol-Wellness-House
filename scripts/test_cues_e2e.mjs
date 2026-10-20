// 테스트 단서 → 장부 저장 확인(2026-10-18, 로드맵 7번): 실제 응시 기록 하나를 읽기만 하고(ssol_* 쓰기 없음), 임시 사용자 장부에 반영한 뒤
// 다시 읽어 같은 결과인지·재반영이 멱등인지·다른 결과로 바꾸면 이전 근거가 대체되는지 본다. 끝나면 임시 기록 삭제.
// 실행: node --env-file=.env.local scripts/test_cues_e2e.mjs
import { createClient } from "@supabase/supabase-js";
import * as RS from "../lib/interp/vendor/rootState.mjs";
import { buildBands, buildCues, buildTestInput, TEST_DOMAINS, TEST_PAIRS } from "../lib/interp/testInput.ts";

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };
const cues = buildCues((await a.from("sw_ob_test_root_cues").select("*").limit(2000)).data), bands = buildBands((await a.from("sw_ob_test_bands").select("*")).data);
RS.setData({ testTable: { bands, pairs: TEST_PAIRS, domains: TEST_DOMAINS, cues } });
const rows = (await a.from("ssol_quiz_results").select("id,type_key,factor_scores,sub_scores,created_at").not("user_id", "is", null).order("created_at", { ascending: false }).limit(20)).data;
const tests = rows.map(buildTestInput).filter(Boolean);
const email = `testcue${Date.now()}@mailinator.com`;
const { data: u } = await a.auth.admin.createUser({ email, password: "Tmp-" + Math.random().toString(36).slice(2) + "A1!", email_confirm: true });
const uid = u.user.id;
const apply = async (t) => {
  const { data } = await a.rpc("sw_read_ledger", { p_user: uid });
  const states = RS.hydrate(uid, data ?? [], []); const sink = [];
  RS.applyTestCues(states, uid, t, cues, sink);
  if (sink.length) { const { error } = await a.rpc("sw_apply_ops", { p_user: uid, p_ops: sink }); if (error) throw new Error(error.message); }
  return sink.length;
};
const scores = async () => Object.fromEntries(Object.values(RS.hydrate(uid, (await a.rpc("sw_read_ledger", { p_user: uid })).data ?? [], [])).filter((s) => s.score > 0).map((s) => [s.root_id, s.score]));
try {
  const [t1, t2] = [tests[0], tests.find((t) => t.test_id !== tests[0].test_id && `${t.main_domain}-${t.coping}` !== `${tests[0].main_domain}-${tests[0].coping}`) ?? tests[1]];
  const n1 = await apply(t1); const s1 = await scores();
  ok(n1 > 0 && Object.keys(s1).length > 0, `첫 반영: 사건 ${n1}건, 점수 있는 뿌리 ${Object.keys(s1).length}개`);
  ok((await apply(t1)) === 0, "같은 결과를 다시 반영해도 변화 없음(멱등)");
  const n2 = await apply(t2); const s2 = await scores();
  ok(n2 > 0 && JSON.stringify(s1) !== JSON.stringify(s2), `다른 결과로 바꾸면 대체됨(사건 ${n2}건)`);
  const direct = {}; { const st = {}, sink = []; const r = RS.applyTestCues(st, uid, t2, cues, sink); for (const e of r.entries) if (e.direction !== "goal") direct[e.root] = e.points; }
  ok(Object.entries(direct).every(([r, p]) => s2[r] === p) && Object.keys(s2).length === Object.keys(direct).length, "저장 후 다시 읽은 점수 = 계산 점수(이전 근거 남지 않음)");
} catch (e) { console.error("❌ 오류:", e.message); bad++; }
finally { await a.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await a.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과"); process.exit(bad ? 1 : 0);
