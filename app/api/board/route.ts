import { NextRequest, NextResponse } from "next/server";
import { getUserIdFast } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadEpisodes, loadGuides, upcomingEpisodes } from "@/lib/board/fetchSite";
import type { Basis } from "@/lib/board/data";

// 고민 타파 목록(요청문 v1.9.4 10장): 고민 가이드 목록 + 고민우체국 회차 + 글자 구름 기준(이 사람의 "기저 생각").
// 기저 생각: 테스트 결과에서 오기로 되어 있지만 이 앱에는 아직 그 값이 없어서, 갓생러모임에서 고른 마음(가장 최근 챌린지)을 쓴다. 없으면 "테스트 전"(none).
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFast(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const [guides, episodes, ch] = await Promise.all([
    loadGuides(),
    loadEpisodes(),
    createAdminClient().from("challenges").select("theme").eq("user_id", userId).order("seq", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const theme = (ch.data as { theme?: string } | null)?.theme;
  const basis: Basis = theme === "worry" || theme === "delay" || theme === "energy" ? theme : "none";
  return NextResponse.json({ guides: guides.data, episodes: episodes.data, upcoming: upcomingEpisodes(), basis, stale: guides.stale || episodes.stale, source: guides.source });
}
