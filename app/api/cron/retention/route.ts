import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 보관 기간 정리(2026-10-27, CSO 결정 F4 + 방침 예고 4항): 마지막 이용일로부터 12개월이면 쏘웰라 해석 기록을 숨기고(sw_hide_user_records), 24개월이면 해석 기록을 실제 삭제하고(sw_purge_user),
// **대화 원문(chat_sessions → chat_messages 연쇄 삭제)도 24개월이 지나면 파기**한다 — CSO 함수 sw_purge_inactive는 sw_* 표만 지우므로 대화 원문은 여기서 따로 지운다. 유효 이용권이 있는 사용자는 모두 제외.
// 안전장치: 기본은 **드라이런(아무것도 지우지 않고 개수만 기록)**. 실제로 지우려면 환경변수 SW_RETENTION_ENABLED=1. CRON_SECRET이 없으면 어떤 요청도 거부(Vercel cron은 Authorization: Bearer <CRON_SECRET>을 자동으로 붙임).
// 응답·로그에는 개수만 남기고 대화 내용·사용자 식별 정보는 남기지 않는다.
export const runtime = "nodejs";
const HIDE_MONTHS = 12, DELETE_MONTHS = 24;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았습니다." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  const live = process.env.SW_RETENTION_ENABLED === "1";
  const admin = createAdminClient();
  const out: Record<string, unknown> = { mode: live ? "실제 정리" : "드라이런(아무것도 지우지 않음)" };

  // 1) 쏘웰라 해석 기록: 12개월 숨김 · 24개월 삭제(CSO 함수)
  const sw = await admin.rpc("sw_purge_inactive", { p_hide_months: HIDE_MONTHS, p_delete_months: DELETE_MONTHS, p_dry_run: !live });
  out.sw_records = sw.error ? { error: sw.error.code } : sw.data;

  // 2) 대화 원문: 마지막 대화가 24개월 이전인 세션 중 유효 이용권이 없는 사용자의 것
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - DELETE_MONTHS);
  const { data: old, error: oe } = await admin.from("chat_sessions").select("session_id, user_id").lt("last_message_at", cutoff.toISOString()).limit(5000);
  if (oe) { out.chat = { error: oe.code }; return NextResponse.json(out); }
  const users = [...new Set((old ?? []).map((r) => r.user_id))];
  const { data: ent } = users.length ? await admin.from("chat_entitlements").select("user_id, status, expires_at").in("user_id", users).eq("status", "active") : { data: [] };
  const keep = new Set((ent ?? []).filter((e) => !e.expires_at || new Date(e.expires_at) > new Date()).map((e) => e.user_id));
  const doomed = (old ?? []).filter((r) => !keep.has(r.user_id)).map((r) => r.session_id);
  let deleted = 0;
  if (live && doomed.length) {
    for (let i = 0; i < doomed.length; i += 200) {
      const { error } = await admin.from("chat_sessions").delete().in("session_id", doomed.slice(i, i + 200)); // chat_messages는 on delete cascade
      if (error) { out.chat = { error: error.code, deleted }; return NextResponse.json(out); }
      deleted += Math.min(200, doomed.length - i);
    }
  }
  out.chat = { 대상_세션: doomed.length, 지움: deleted };
  console.log("보관 기간 정리", JSON.stringify(out));
  return NextResponse.json(out);
}
