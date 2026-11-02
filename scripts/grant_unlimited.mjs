// 이용권 수동 부여(만료일 없음) — 대표님 요청으로 특정 계정에 "기한 없이 구독 연장이 필요 없는" 활성 이용권을 만든다.
//   node --env-file=.env.local scripts/grant_unlimited.mjs <이메일>            ← 먼저 조회만 한다(쓰지 않음)
//   node --env-file=.env.local scripts/grant_unlimited.mjs <이메일> --apply    ← 실제로 부여
// chat_entitlements(우리 표)에만 쓴다. ssol_* 표는 건드리지 않는다. 이미 같은 메모의 활성·무기한 행이 있으면 새로 만들지 않는다.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const apply = process.argv.includes("--apply");
if (!email) throw new Error("이메일을 넣어 주세요");
const NOTE = "수동 부여: 무기한(만료일 없음) — 대표님 요청";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth.users: ${error.message}`);
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 1000) break;
}
if (!user) {
  console.log("계정이 없습니다 — 먼저 앱에서 이 이메일로 가입해 주세요.");
  process.exit(2);
}
console.log(`계정 있음 (id 앞 8자리 ${user.id.slice(0, 8)}, 익명 아님: ${user.is_anonymous !== true})`);

const { data: rows, error } = await admin.from("chat_entitlements").select("id,plan,status,expires_at,note").eq("user_id", user.id);
if (error) throw new Error(`chat_entitlements: ${error.message}`);
console.log(`기존 이용권 ${rows.length}건:`, rows.map((r) => `${r.plan}/${r.status}/${r.expires_at ?? "만료일 없음"}`));

const already = rows.find((r) => r.status === "active" && r.expires_at === null);
if (already) {
  console.log("이미 만료일 없는 활성 이용권이 있습니다 — 추가하지 않습니다.");
  process.exit(0);
}
if (!apply) {
  console.log("(조회만 했습니다. 부여하려면 --apply)");
  process.exit(0);
}
const { data: ins, error: insErr } = await admin
  .from("chat_entitlements")
  .insert({ user_id: user.id, plan: "annual", status: "active", amount: 0, starts_at: new Date().toISOString(), expires_at: null, note: NOTE })
  .select("id,plan,status,expires_at")
  .single();
if (insErr) throw new Error(`부여 실패: ${insErr.message}`);
console.log("부여 완료:", ins);
