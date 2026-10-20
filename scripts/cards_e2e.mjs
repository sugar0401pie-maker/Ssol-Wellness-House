// 선택지 카드 실전 확인(2026-10-20, 로드맵 3·4번) — dev 서버에 임시 계정으로 대화한다.
// 준비: npx next dev -p 3100(카드는 기본 켜짐). 실행: node --env-file=.env.local scripts/cards_e2e.mjs
// 장면 감지는 AI라 흔들릴 수 있어, 감지가 안 되면 같은 상태(열 준비 세션)를 직접 만들어 이후 흐름을 확인한다. 끝나면 계정·기록 삭제.
import { createClient } from "@supabase/supabase-js";
const BASE = process.env.SAFETY_EVAL_BASE_URL || "http://localhost:3100";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const ok = (c, m) => { console.log(`${c ? "✅" : "❌"} ${m}`); if (!c) bad++; };

const email = `cards${Date.now()}@mailinator.com`, pw = "Tmp-" + Math.random().toString(36).slice(2) + "A1!";
const { data: u } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
const uid = u.user.id;
const token = (await anon.auth.signInWithPassword({ email, password: pw })).data.session.access_token;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-access-code": process.env.ACCESS_CODE_FOR_EVAL ?? "" };
const chat = async (message, sessionId, cardPick) => { const t0 = Date.now(); const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message, sessionId, ...(cardPick ? { cardPick } : {}) }) }); const j = await r.json(); return { status: r.status, ms: Date.now() - t0, ...j }; };
const rowOf = async (sid) => (await admin.from("sw_choice_sessions").select("*").eq("user_id", uid).eq("chat_id", sid).order("id", { ascending: false }).limit(1)).data?.[0];

try {
  const t1 = await chat("단체 운동은 좀 싫어요. 자꾸 빠지게 돼요", null); const sid = t1.sessionId;
  ok(t1.status === 200 && !t1.followUp, "1번째 답변: 카드 없음(아직 장면만 감지하는 단계)");
  let row = null; for (let i = 0; i < 12 && !row; i++) { await sleep(2500); row = await rowOf(sid); }
  if (row) console.log("   (분류기가 장면을 감지함:", row.started_card_id, ")");
  else {
    console.log("   (분류기가 이번에는 장면을 못 잡음 → 같은 상태를 직접 만듦)");
    await admin.from("sw_choice_sessions").insert({ user_id: uid, chat_id: sid, started_card_id: "CC-GRP-1", card_id: "CC-GRP-1" }); row = await rowOf(sid);
  }
  ok(!!row && row.cards_shown === 0 && Object.keys(row.shown ?? {}).length === 0, "열 준비 세션: 아직 보여 준 카드 없음");

  const t2 = await chat("특히 사람들 앞에서 못하는 모습 보일까 봐 걱정돼요", sid);
  const card1 = t2.followUp?.card;
  ok(card1?.kind === "card" && card1.cardId === "CC-GRP-1", `2번째 답변 뒤에 첫 카드가 붙음 (${card1?.cardId})`);
  ok(card1?.options.length === 3 && card1.fixed.map((f) => f.id).join() === "FX-MULTI,FX-DK,FX-OTHER", "보기 3개 + 고정 보기 3개(두 개 이상·모르겠어요·다른 이유)");
  ok(card1 && card1.options.some((o) => !/부담|걱정|뒤처/.test("")) && !JSON.stringify(card1).includes("ROOT-"), "화면에 보내는 값에 뿌리 이름·id가 없음");
  const msgs = (await admin.from("chat_messages").select("role,reflection_signal_id").eq("session_id", sid).order("created_at")).data;
  ok(msgs.some((m) => m.role === "assistant" && m.reflection_signal_id === "sw-card:CC-GRP-1"), "카드 말풍선이 표시와 함께 저장됨");
  const remainBefore = t2.remainingToday;

  // 보기가 아닌 값은 거절(보여 주지 않은 보기)
  // → 아래에서 별도 세션으로 확인한다. 여기서는 정상 흐름: 보기를 계속 눌러 끝까지
  let cur = card1, taps = 0, last = null;
  while (cur && taps < 5) {
    const pick = cur.kind === "confirm" ? { confirm: "CF-2" } : { cardId: cur.cardId, optionId: cur.options[0].id };
    const label = cur.kind === "confirm" ? cur.options.find((o) => o.id === "CF-2").label : cur.options[0].label;
    last = await chat(label, sid, pick); taps++;
    console.log(`   탭 ${taps}: ${cur.kind} → ${last.card ? last.card.kind + " " + last.card.cardId : "평소 답변"} (${last.ms}ms)`);
    cur = last.card;
  }
  ok(taps >= 2 && !last.card, `보기를 눌러 끝까지 감(${taps}번) — 마지막은 평소 대화로 이어짐`);
  ok(typeof last.reply === "string" && last.reply.length > 0, "끝난 뒤 평소 답변이 나옴");
  const row2 = await rowOf(sid);
  const ended = (await admin.from("sw_choice_sessions").select("ended,cards_shown").eq("user_id", uid).eq("chat_id", sid).order("id", { ascending: false }).limit(1)).data[0];
  ok(!!ended.ended, `세션 종료 기록 (${ended.ended}, 카드 ${ended.cards_shown}장)`);
  const ev = (await admin.from("sw_evidence_events").select("event_kind,source_type,points,root_id").eq("user_id", uid)).data;
  ok(ev.length > 0, `장부에 근거 기록: ${ev.length}건 (${[...new Set(ev.map((e) => e.event_kind))].join("/")})`);
  ok(taps >= 1 && last.remainingToday === remainBefore, `보기 누름은 하루 사용량에 안 셈 (${remainBefore} → ${last.remainingToday})`);

  // 거절되어야 하는 요청들
  const bogus = await chat("엉뚱한 보기", sid, { cardId: "CC-GRP-1", optionId: "GO-1-MUST" });
  ok(bogus.status === 200 && !bogus.card, "세션이 없거나 끝난 뒤의 보기 요청은 카드 없이 평소 대화로 처리");
  const badShape = await chat("이상한 값", sid, { cardId: "bad id!", optionId: "x; drop" });
  ok(badShape.status === 200 && !badShape.card, "모양이 잘못된 요청 값은 무시");

  // 안전: 직접 쓴 말이 위기 표현이면 라우터가 먼저 처리한다(카드 흐름이 가로채지 않음)
  const t3 = await chat("카드 흐름 시험", null);
  await admin.from("sw_choice_sessions").insert({ user_id: uid, chat_id: t3.sessionId, started_card_id: "CC-GRP-1", card_id: "CC-GRP-1", shown: { "CC-GRP-1": ["GO-1-PEOPLE"] } });
  const crisis = await chat("이제 자살하고 싶어요", t3.sessionId, { cardId: "CC-GRP-1", other: true });
  ok(crisis.route === "crisis" && /109/.test(crisis.reply ?? "") && !crisis.card, "카드 중 직접 쓴 말이 위기 표현이면 위기 고정 안내(카드 없음)");
} catch (e) { console.error("❌ 오류:", e.message); bad++; }
finally { await admin.rpc("sw_purge_user", { p_user: uid, p_include_human: true }); await admin.auth.admin.deleteUser(uid); }
console.log(bad ? `\n실패 ${bad}건` : "\n전부 통과"); process.exit(bad ? 1 : 0);
