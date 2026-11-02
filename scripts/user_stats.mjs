// 쏘웰라 가입자 수 집계 (읽기 전용 — DB에 쓰지 않고, 이메일·이름 같은 개인 정보는 출력하지 않는다).
//   node --env-file=.env.local scripts/user_stats.mjs
// auth.users는 퀴즈·결제 사이트(ssolwellness.com 계열)와 공유라서 "계정 수"는 쏘웰라 가입자 수가 아니다.
// 쏘웰라 가입(앱 회원가입 때 약관 동의가 기록된 사람)과 실제로 쓴 사람(온보딩·채팅)을 따로 센다.
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const kstDay = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(d)); // YYYY-MM-DD
const today = kstDay(Date.now());
const daysAgo = (n) => kstDay(Date.now() - n * 86400000);

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth.users: ${error.message}`);
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

const pageRows = async (table, cols) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).order(cols.split(",")[0]).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
};

const profiles = await pageRows("profiles", "user_id,terms_agreed_at");
const onboarding = await pageRows("user_onboarding", "user_id,status");
const sessions = await pageRows("chat_sessions", "session_id,user_id");

const real = users.filter((u) => u.is_anonymous !== true);
const providerOf = (u) => u.app_metadata?.provider ?? "email";
const byProvider = {};
for (const u of real) byProvider[providerOf(u)] = (byProvider[providerOf(u)] ?? 0) + 1;

const realIds = new Set(real.map((u) => u.id));
const agreed = profiles.filter((p) => p.terms_agreed_at && realIds.has(p.user_id));
const agreedIds = new Set(agreed.map((p) => p.user_id));
const createdOf = new Map(users.map((u) => [u.id, u.created_at]));
const onboarded = onboarding.filter((o) => o.status === "completed" && realIds.has(o.user_id));
const chatters = new Set(sessions.map((s) => s.user_id).filter((id) => realIds.has(id)));

const countSince = (ids, day) => [...ids].filter((id) => kstDay(createdOf.get(id)) >= day).length;
const countOn = (ids, day) => [...ids].filter((id) => kstDay(createdOf.get(id)) === day).length;

console.log(`기준일(KST): ${today}`);
console.log(`전체 계정(퀴즈·결제 사이트와 공유, 익명 포함): ${users.length}`);
console.log(`  익명 제외 실제 계정: ${real.length}  — 가입 방식별: ${JSON.stringify(byProvider)}`);
console.log(`쏘웰라 가입자(약관 동의 기록 있음): ${agreedIds.size}`);
console.log(`  오늘 가입: ${countOn(agreedIds, today)} · 최근 7일: ${countSince(agreedIds, daysAgo(6))} · 최근 30일: ${countSince(agreedIds, daysAgo(29))}`);
console.log(`온보딩 완료: ${new Set(onboarded.map((o) => o.user_id)).size}`);
console.log(`채팅을 한 번이라도 한 사람: ${chatters.size}`);
// 약관 동의·온보딩 시작·채팅 중 하나라도 있으면 "쏘웰라를 실제로 쓴 사람". 소셜(카카오·네이버) 가입자는 추가 정보 입력이 선택이라 약관 기록만으론 빠질 수 있다.
const anyOnboarding = new Set(onboarding.map((o) => o.user_id).filter((id) => realIds.has(id)));
const used = new Set([...agreedIds, ...anyOnboarding, ...chatters]);
const usedByProvider = {};
for (const u of real) if (used.has(u.id)) usedByProvider[providerOf(u)] = (usedByProvider[providerOf(u)] ?? 0) + 1;
console.log(`쏘웰라를 실제로 쓴 사람(약관·온보딩·채팅 중 하나라도): ${used.size} — ${JSON.stringify(usedByProvider)}`);
console.log(`  가입 시점 기준 — 오늘: ${countOn(used, today)} · 최근 7일: ${countSince(used, daysAgo(6))} · 최근 30일: ${countSince(used, daysAgo(29))}`);
