// 쏘웰라 해석 DB v1.6 적용 후 검증 — 2026-10-18
// apply_v1.9.sql 실행 + sw_load_reference.mjs --apply 이후에 돌린다. 임시 사용자 2명(mailinator)을 만들어 시험하고, 끝나면(실패해도) 지운다.
// 하나라도 실패하면 종료 코드 1 — 그때는 supabase/sw_interp/rollback_v1.6.sql 로 되돌린다.
//   node scripts/sw_verify_live.mjs --dir <CSV 폴더>
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./sw_csv.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* 이미 환경 변수가 있으면 됨 */ }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DIR = (() => { const i = process.argv.indexOf("--dir"); return i >= 0 ? process.argv[i + 1] : null; })();
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const t = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const near = (a, b) => Math.abs(Number(a) - b) < 1e-9;

const REF = fs.readFileSync("supabase/sw_interp/apply_v1.9.sql", "utf8");
const obTables = [...REF.matchAll(/create table if not exists public\.(sw_ob_\w+) \(/g)].map((m) => m[1]);
const stateTables = ["sw_user_signals", "sw_user_root_state", "sw_evidence_events", "sw_choice_sessions", "sw_root_turn_log", "sw_hs_sessions", "sw_hs_root_judgments", "sw_hs_safety", "sw_hypothesis_log"];
const count = async (tb) => { const { count: c, error } = await admin.from(tb).select("*", { count: "exact", head: true }); return error ? { error } : { c }; };
const rpc = (fn, a) => admin.rpc(fn, a);
const state = async (u, root) => (await admin.from("sw_user_root_state").select("*").eq("user_id", u).eq("root_id", root).maybeSingle()).data;
const apply = async (u, ops) => { const { data, error } = await rpc("sw_apply_ops", { p_user: u, p_ops: ops }); return { data, error }; };

const mkUser = async (tag) => {
  const email = `sw-verify-${tag}-${Date.now()}@mailinator.com`, password = "Tmp!" + Math.random().toString(36).slice(2) + "Aa1";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error; return { id: data.user.id, email, password };
};
const users = [];
const before = {};
try {
  for (const tb of ["profiles", "chat_sessions", "chat_messages", "chat_entitlements", "wellness_practices", "theory_signals"]) before[tb] = (await count(tb)).c;

  // 1) 표 존재 · 행 수
  let missing = [];
  for (const tb of [...obTables, ...stateTables]) { const r = await count(tb); if (r.error) missing.push(`${tb}(${r.error.code})`); }
  t("sw_ 표 64개 모두 읽힘(서버 키)", missing.length === 0, missing.join(", "));
  if (DIR) {
    let bad = [];
    for (const tb of obTables) {
      const rows = parseCsv(fs.readFileSync(path.join(DIR, `${tb}.csv`), "utf8")).filter((r) => !(r.length === 1 && r[0] === null));
      const expected = rows.length - 1;
      const { c } = await count(tb);
      if (c !== expected) bad.push(`${tb} ${c}/${expected}`);
    }
    t(`참조표 ${obTables.length}개 행 수가 CSV와 정확히 같음`, bad.length === 0, bad.slice(0, 5).join(", "));
  }
  // 뿌리 수는 CSV(--dir)가 있으면 CSV 행 수와 같은지로, 없으면 v4.0 기준 109개(v1.9는 106개)로 확인한다.
  const roots = await count("sw_ob_roots");
  const rootsExpected = DIR ? parseCsv(fs.readFileSync(path.join(DIR, "sw_ob_roots.csv"), "utf8")).filter((r) => !(r.length === 1 && r[0] === null)).length - 1 : 109;
  t(`뿌리 ${rootsExpected}개`, roots.c === rootsExpected, `실제 ${roots.c}`);

  // 2) 접근 제한: anon · 로그인 사용자는 sw_ 표를 읽지 못하고 함수를 부르지 못해야 함
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const a1 = await anon.from("sw_ob_roots").select("root_id").limit(1);
  t("anon: 참조표 읽기 거절", !!a1.error || (a1.data ?? []).length === 0, a1.error?.code ?? "빈 결과");
  const a2 = await anon.rpc("sw_apply_ops", { p_user: "00000000-0000-0000-0000-000000000000", p_ops: [] });
  t("anon: 함수 실행 거절", !!a2.error, a2.error?.code);
  const U1 = await mkUser("a"); users.push(U1); const U2 = await mkUser("b"); users.push(U2);
  const authed = createClient(URL, ANON, { auth: { persistSession: false } });
  const si = await authed.auth.signInWithPassword({ email: U1.email, password: U1.password });
  t("임시 사용자 로그인", !si.error);
  const u1 = await authed.from("sw_user_root_state").select("*").limit(1);
  t("로그인 사용자: 상태 표 읽기 거절", !!u1.error || (u1.data ?? []).length === 0, u1.error?.code ?? "빈 결과");
  const u2 = await authed.rpc("sw_apply_ops", { p_user: U1.id, p_ops: [] });
  t("로그인 사용자: 함수 실행 거절", !!u2.error, u2.error?.code);

  // 3) 기능
  const R = "ROOT-48";
  const testOp = (uid, ev = "test:T1:ROOT-48", pts = 2.0) => ({ op: "apply", event_id: ev, root_id: R, source_type: "test", points: pts, link: "support", polarity: "present", claim_id: null, meta: {} });
  let r = await apply(U1.id, [testOp(U1.id)]);
  t("테스트 근거 2.0 기록", !r.error && r.data?.[0]?.result === "applied", r.error?.message ?? r.data?.[0]?.result);
  let s = await state(U1.id, R); t("점수 2.0 · 후보", s && near(s.score, 2) && s.status === "candidate", `${s?.score}/${s?.status}`);
  const chatOp = { op: "apply", event_id: "msg1:C48-SEEN-LESS:ROOT-48", root_id: R, source_type: "chat", points: 1.0, link: "support", polarity: "present", claim_id: "C48-SEEN-LESS", chat_id: "c-test-1",
    meta: { key: "ROOT-48|C48-SEEN-LESS", evidence: "못하는 게 드러날까 봐요", confidence: 0.9, message_id: "msg1" } };
  r = await apply(U1.id, [chatOp]); s = await state(U1.id, R);
  t("대화 근거 1.0 → 3.0, 출처 2곳이면 유력", near(s.score, 3) && s.status === "likely", `${s?.score}/${s?.status}`);
  r = await apply(U1.id, [chatOp]); t("같은 사건 다시 보내면 중복으로 무시", r.data?.[0]?.result === "duplicate", r.data?.[0]?.result ?? r.error?.message);
  r = await apply(U1.id, [{ ...chatOp, points: 1.5 }]); t("같은 id 다른 내용은 오류", !!r.error, r.error?.message?.slice(0, 40));
  s = await state(U1.id, R); t("오류 뒤에도 점수 그대로(3.0)", near(s.score, 3), String(s?.score));
  r = await apply(U2.id, [testOp(U2.id)]); s = await state(U2.id, R);
  t("다른 사용자의 같은 event_id는 각각 반영", r.data?.[0]?.result === "applied" && near(s.score, 2), `${r.data?.[0]?.result}/${s?.score}`);
  const led = (await rpc("sw_read_ledger", { p_user: U1.id })).data ?? [];
  const chatRow = led.find((e) => e.event_id === chatOp.event_id);
  t("장부 읽기: 순서대로 · 원문 조각 저장됨(대표 결정)", led.length >= 2 && chatRow?.meta?.evidence === "못하는 게 드러날까 봐요" && led.every((e, i) => i === 0 || e.seq > led[i - 1].seq));
  t("대화 id가 uuid가 아니면 null + chat_ref에 보존", chatRow && chatRow.chat_id === null && chatRow.meta?.chat_ref === "c-test-1", `${chatRow?.chat_id}/${chatRow?.meta?.chat_ref}`);
  r = await apply(U1.id, [{ op: "supersede", event_id: chatOp.event_id }]); s = await state(U1.id, R);
  t("대화 근거 정정 → 테스트 2.0 유지", near(s.score, 2) && s.status === "candidate", `${s?.score}/${s?.status}`);
  r = await apply(U1.id, [{ op: "set_status", event_id: "st:1", root_id: R, status_to: "confirmed", source_type: "chat", confirmation_scope: { module: "grp" } }]); s = await state(U1.id, R);
  t("확인(맞아요) → confirmed", s.status === "confirmed", s?.status);
  r = await apply(U1.id, [{ op: "supersede", event_id: "st:1" }]); s = await state(U1.id, R);
  t("확인 정정 → 점수 기준으로 복귀(고착 없음)", s.status === "candidate" && near(s.score, 2), `${s?.status}/${s?.score}`);
  r = await apply(U1.id, [{ op: "apply", event_id: "goal:1", root_id: "ROOT-37", source_type: "chat", points: 1, link: "goal", polarity: "absent", claim_id: "X" }]);
  const g = await state(U1.id, "ROOT-37"); t("목표 근거는 점수 0", r.data?.[0]?.result === "recorded_no_score" && (!g || near(g.score, 0)), `${r.data?.[0]?.result}/${g?.score}`);
  for (const [name, op] of [["status 'maybe'", { op: "set_status", event_id: "bad:1", root_id: R, status_to: "maybe", source_type: "chat" }], ["source 'choice'", { ...testOp(U1.id, "bad:2"), source_type: "choice" }], ["link 'maybe'", { ...testOp(U1.id, "bad:3"), link: "maybe" }], ["알 수 없는 op", { op: "explode", event_id: "bad:4" }]]) {
    const x = await apply(U1.id, [op]); t(`잘못된 값 거절: ${name}`, !!x.error, x.error?.code);
  }
  const par = await Promise.all(Array.from({ length: 30 }, (_, i) => apply(U1.id, [{ op: "apply", event_id: `par:${i}`, root_id: "ROOT-49", source_type: "chat", points: 1, link: "support", polarity: "present", claim_id: `P${i}` }])));
  const p49 = await state(U1.id, "ROOT-49"); t("동시 30건 → 합계 30(어긋남 없음)", par.every((x) => !x.error) && near(p49.score, 30), `${p49?.score}`);

  // 4) 삭제·보관
  // v4.0: sw_purge_inactive(p_hide_months, p_delete_months, p_dry_run) — 12개월 미이용 숨김 · 24개월 미이용 실제 삭제. 드라이런은 아무것도 바꾸지 않는다.
  const dry = await rpc("sw_purge_inactive", { p_hide_months: 12, p_delete_months: 24, p_dry_run: true });
  t("미이용 삭제 드라이런: 아무것도 안 지움", !dry.error && dry.data?.dry_run === true, dry.error?.message ?? JSON.stringify(dry.data).slice(0, 80));
  const hl = await admin.from("sw_hypothesis_log").insert({ user_id: U1.id, candidates: [{ root_id: "ROOT-48", score: 2 }], chosen_root: "ROOT-48", chosen_by: "ai" });
  t("가설 판정 기록 1건 저장", !hl.error, hl.error?.message);
  const hbad = await admin.from("sw_hypothesis_log").insert({ user_id: U1.id, chosen_by: "robot" });
  t("가설 판정 기록: 잘못된 선택 주체 거절", !!hbad.error, hbad.error?.code);
  const pu = await rpc("sw_purge_user", { p_user: U1.id, p_include_human: false });
  const left = (await admin.from("sw_evidence_events").select("event_id", { count: "exact", head: true }).eq("user_id", U1.id)).count;
  const leftS = (await admin.from("sw_user_root_state").select("root_id", { count: "exact", head: true }).eq("user_id", U1.id)).count;
  const leftH = (await admin.from("sw_hypothesis_log").select("id", { count: "exact", head: true }).eq("user_id", U1.id)).count;
  t("삭제 요청: 사용자 1의 sw_ 행만 지움(가설 판정 기록 포함)", !pu.error && left === 0 && leftS === 0 && leftH === 0, pu.error?.message ?? JSON.stringify(pu.data));
  s = await state(U2.id, R); t("다른 사용자(2)는 그대로", s && near(s.score, 2));
  const prof = (await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("user_id", U1.id)).count;
  t("삭제 요청이 계정·프로필은 건드리지 않음", prof === 1, String(prof));

  // 5) 기존 표 영향 없음
  const bad = [];
  for (const [tb, n] of Object.entries(before)) { const c = (await count(tb)).c; if (c < n) bad.push(`${tb} ${n}→${c}`); }
  t("기존 표 행 수가 줄지 않음(profiles·chat_*·이용권·실천·판별문장)", bad.length === 0, bad.join(", "));
} catch (e) {
  t("검증 중 예외", false, e.message);
} finally {
  for (const u of users) {
    await admin.rpc("sw_purge_user", { p_user: u.id, p_include_human: true });
    await admin.auth.admin.deleteUser(u.id);
  }
  const still = users.length ? (await admin.from("sw_evidence_events").select("event_id", { count: "exact", head: true }).in("user_id", users.map((u) => u.id))).count : 0;
  console.log(`임시 사용자 ${users.length}명 삭제 완료 · 남은 장부 행 ${still}`);
}
const fails = results.filter((x) => !x.ok);
console.log(`\n결과: ${results.length - fails.length}/${results.length} 통과`);
if (fails.length) { console.log("실패:", fails.map((f) => f.name).join(" | ")); console.log("→ 되돌리려면 supabase/sw_interp/rollback_v1.6.sql 을 실행하세요."); process.exit(1); }
console.log("모두 통과 — 되돌릴 필요 없음.");
