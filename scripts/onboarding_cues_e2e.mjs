// 온보딩 단서 실전 확인(2026-10-20, 로드맵 7번) — 임시 계정에 온보딩 답을 넣고 대화 한 번으로 장부에 단서가 들어가는지, 동의를 거두면 정정되는지 본다.
// 준비: `npm run dev`(포트 3100). 실행: node --env-file=.env.local scripts/onboarding_cues_e2e.mjs. 끝나면 계정·기록 삭제. 답 원문은 출력하지 않는다.
import { createClient } from "@supabase/supabase-js";
const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };
const email = `onbcue${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: u } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
const uid = u.user.id;
const token = (await anon.auth.signInWithPassword({ email, password: pw })).data.session.access_token;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
const chat = async (message, sessionId) => (await fetch(`${BASE}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message, sessionId }) })).json();
const active = async () => (await admin.from("sw_evidence_events").select("root_id,points,link,validity,source_type").eq("user_id", uid).eq("source_type", "onboarding").eq("validity", "active")).data ?? [];
const waitFor = async (pred, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await active(); if (pred(v)) return v; await sleep(3000); } return await active(); };

try {
  const base = { user_id: uid, status: "completed", personalization_consent: true, completed_at: new Date().toISOString(), relationship_status: "has_partner", childcare_status: "none", primary_activity: "full_time",
    values_ranked: [{ key: "career_success", rank: 1 }, { key: "learning_growth", rank: 2 }, { key: "financial_stability", rank: 3 }],
    hobbies_ranked: [{ key: "solo_running", rank: 1 }, { key: "reading_cafe", rank: 2 }, { key: "learning", rank: 3 }],
    weekends_ranked: [{ key: "outdoors", rank: 1 }, { key: "solo_hobby", rank: 2 }, { key: "new_experience", rank: 3 }],
    focus_domains: ["work_career", "self_emotions"], daily_time: ["under_5"], excluded_activities: [] };
  const { error: ie } = await admin.from("user_onboarding").insert(base);
  if (ie) throw new Error("온보딩 행 넣기 실패: " + ie.message);

  const t1 = await chat("요즘 회사 일이 많아서 좀 지쳐요", null);
  ok(!t1.error, "대화 정상");
  const ev = await waitFor((v) => v.length > 0);
  const scored = ev.filter((e) => e.link === "support" && Number(e.points) > 0);
  ok(scored.length > 0, `온보딩 단서가 장부에 들어감: 뿌리 ${scored.length}개`);
  ok(scored.every((e) => Number(e.points) <= 2.5), `뿌리당 상한 2.5 이하 (최고 ${Math.max(...scored.map((e) => Number(e.points)))})`);
  ok(new Set(scored.map((e) => e.root_id)).size === scored.length, "같은 뿌리의 활성 온보딩 사건은 하나뿐");

  // 마이페이지: 대화 근거 없이 고른 답만으로는 2.0 이상만 보인다
  const ins = await (await fetch(`${BASE}/api/mypage/insights`, { headers: H })).json();
  const top = Math.max(0, ...scored.map((e) => Number(e.points)));
  ok(Array.isArray(ins.items) && ins.items.every((i) => i.from === "answers" || i.from === "chat"), `마이페이지 항목 ${ins.items?.length}개(출처 표시 정상)`);
  ok(top >= 2.0 ? ins.items.length > 0 : ins.items.length === 0, "2.0 이상 단서가 있을 때만 목록에 나옴");

  // 같은 답으로 다시 대화해도 사건이 늘지 않는다(멱등)
  const n1 = (await active()).length; await chat("오늘도 야근이에요", t1.sessionId); await sleep(15000);
  ok((await active()).length === n1, "다시 대화해도 사건 수 그대로(멱등)");

  // 동의를 거두면 이전 온보딩 근거가 정정된다
  await admin.from("user_onboarding").update({ personalization_consent: false, updated_at: new Date().toISOString() }).eq("user_id", uid);
  await chat("그냥 계속 힘드네요", t1.sessionId);
  const after = await waitFor((v) => v.length === 0, 45000);
  ok(after.length === 0, `개인화 동의를 거두면 온보딩 근거가 모두 정정됨 (남은 활성 ${after.length}건)`);

  // 위기 경로는 영향 없음
  const cr = await chat("이제 자살하고 싶어요", t1.sessionId);
  ok(cr.route === "crisis" && /109/.test(cr.reply ?? ""), "위기 문장은 그대로 위기 고정 안내");
} catch (e) { console.error("❌ 오류:", e.message); bad++; }
finally { await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await admin.from("user_onboarding").delete().eq("user_id", uid); await admin.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과"); process.exit(bad ? 1 : 0);
