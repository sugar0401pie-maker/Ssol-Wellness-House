import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { loadQuizPersona } from "@/lib/mypage/loadQuizPersona";
import { loadTarotWelcome } from "@/lib/tarot/loadTarotInsight";
import { TAROT_CARDS } from "@/lib/tarot/catalog";
import { loadAstroGreeting } from "@/lib/mypage/loadAstroGreeting";
import { astroOpeningFromSearch } from "@/lib/persona/astroGreeting";

// 채팅 첫 화면이 무엇을 보여 줄지 정하려고 부르는 가벼운 조회(2026-10-22): ① 디저트 유형 테스트 결과가 있는지(없으면 성향 질문 대신 일상 문구) ②
// 점성술(쏠 아스트로 하우스) 결과를 보고 넘어온 사용자인지와 그때 고른 "요즘 신경 쓰이는 부분"(Q1) → 환영 인사·시작 문구. 유형·결과 내용은 싣지 않는다.
// astro_results는 점성술 앱 소유라 읽기만 하고, 읽지 못하면 "점성술에서 오지 않음"으로 둔다.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const admin = createAdminClient();
  // 점성술 [쏘웰라와 대화 시작하기]로 들어온 경우(?from=astro&result=…)만 그 결과의 맞춤 첫 인사를 함께 준다(2026-10-26).
  const opening = astroOpeningFromSearch(req.nextUrl.search);
  const safe = async <T,>(f: () => PromiseLike<T>, fallback: T): Promise<T> => { try { return await f(); } catch { return fallback; } };
    // 2026-10-26: 타로 결과 10쪽 버튼으로 넘어오면 ?tarot=<결과 id> — 본인 결과일 때만 고민 글·세 번째 카드로 맞춤 인사.
  const tarotId = req.nextUrl.searchParams.get("tarot");
  const [persona, astro, profile, astroGreeting, tarotRow] = await Promise.all([
    safe(() => loadQuizPersona(admin, userId, { includeReport: false }), null),
    safe(async () => (await admin.from("astro_results").select("answers, nickname").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data, null),
    safe(async () => (await admin.from("profiles").select("nickname, display_name").eq("user_id", userId).maybeSingle()).data, null),
    opening ? safe(() => loadAstroGreeting(admin, userId, opening.resultId), null) : Promise.resolve(null),
    tarotId ? safe(() => loadTarotWelcome(admin, userId, tarotId), null) : Promise.resolve(null),
  ]);
  let tarot: { worry: string | null; card: string | null } | null = null;
  if (tarotRow) {
    const picks = Array.isArray(tarotRow.picks) ? (tarotRow.picks as { id?: string; position?: string }[]) : [];
    const key = picks.find((p) => p.position === "step") ?? picks[2];
    tarot = { worry: tarotRow.worry, card: (key?.id && TAROT_CARDS[key.id]?.name) || null };
  }
  let q1: string | null = null;
  if (astro) {
    let a: unknown = astro.answers;
    if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = null; } }
    const v = (a as { q1?: unknown } | null)?.q1;
    q1 = typeof v === "string" && v.trim() ? v.trim() : null;
  }
  return NextResponse.json({
    hasPersona: !!persona,
    typeName: persona?.name ?? null, // 첫 인사에 쓰는 디저트 유형 이름(결과 내용·점수는 싣지 않음)
    hasReport: persona?.hasReport === true,
    fromAstro: !!astro,
    astroQ1: q1,
    astroGreeting,
    tarot,
    nickname: profile?.nickname || profile?.display_name || tarotRow?.nickname || (astro?.nickname as string | null) || null,
  });
}
