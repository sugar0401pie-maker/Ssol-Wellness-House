// 채팅 이용 코드 만들기(2026-11-24 대표님 요청 — 오프라인 웰니스 세션 패키지용). 코드는 이 화면에 한 번만 나오고 DB에는 지문(sha256)만 남는다.
//   node --env-file=.env.local scripts/make_access_codes.mjs --days 30 [--count 1] [--max-uses 1] [--note "패키지 A · 홍길동"] [--expires 2026-12-31]
//   --days     등록한 날부터 채팅을 쓸 수 있는 일수(남은 이용권이 있으면 그 끝 다음부터)
//   --count    만들 코드 수 · --max-uses 코드 하나를 몇 명이 쓸 수 있는지(기본 1명) · --expires 이 날(한국 날짜)까지만 등록 가능
import { createClient } from "@supabase/supabase-js";
import { formatChatCode, generateChatCode, hashChatCode } from "../lib/billing/chatCode.ts";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const days = Number(opt("days"));
const count = Number(opt("count", "1"));
const maxUses = Number(opt("max-uses", "1"));
const note = opt("note", null);
const expires = opt("expires", null);
if (!Number.isInteger(days) || days < 1 || days > 3650 || !Number.isInteger(count) || count < 1 || count > 200 || !Number.isInteger(maxUses) || maxUses < 1) {
  console.error("사용법: --days 1~3650 (필수) [--count 1~200] [--max-uses 1 이상] [--note 메모] [--expires YYYY-MM-DD]");
  process.exit(1);
}
const expiresAt = expires ? new Date(`${expires}T23:59:59+09:00`).toISOString() : null;
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const codes = Array.from({ length: count }, () => generateChatCode());
const rows = codes.map((c) => ({ code_hash: hashChatCode(c), code_hint: c.slice(-4), days, max_uses: maxUses, note, expires_at: expiresAt }));
const { error } = await a.from("chat_access_codes").insert(rows);
if (error) { console.error("코드 저장 실패:", error.code, error.message); process.exit(1); }
console.log(`코드 ${count}개 — 등록하면 ${days}일 이용 · 코드당 ${maxUses}명${expires ? ` · ${expires}까지 등록 가능` : ""}${note ? ` · ${note}` : ""}`);
for (const c of codes) console.log(formatChatCode(c));
