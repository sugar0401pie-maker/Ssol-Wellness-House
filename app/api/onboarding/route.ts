import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { isOtherTextValid, OTHER_CODE } from "@/lib/onboarding/schema";
import { deriveLegacyPreference } from "@/lib/onboarding/legacyBridge";

// 2026-09-25: SSOL_Onboarding_Development_Spec_v1_0으로 온보딩 전체 교체(기존 2문항 →
// 9문항 + 분기 + 순위선택 + 기타검증). GET은 지금까지 저장된 답변(재개용)을, PATCH는
// 문항 하나씩 즉시 저장(스펙 "매 단계 임시 저장"), POST는 동의와 함께 완료 처리한다.
export const runtime = "nodejs";

// user_onboarding의 실제 컬럼과 1:1로 대응 — 이 목록에 없는 키는 전부 거부한다(허용 목록 방식).
const ANSWER_COLUMNS = new Set([
  "relationship_status",
  "dating_interest",
  "relationship_stage",
  "childcare_status",
  "child_age_groups",
  "primary_activity",
  "values_ranked",
  "hobbies_ranked",
  "weekends_ranked",
  "focus_domains",
  "daily_time",
  "excluded_activities",
]);

function titleFor(gender: string | null | undefined): string {
  if (gender === "female") return "공주";
  if (gender === "male") return "왕자";
  return "공작";
}

export async function GET(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: ssolProfile }, { data: quizResult }, { data: onboarding }] = await Promise.all([
    admin.from("profiles").select("display_name, nickname").eq("user_id", userId).maybeSingle(),
    admin.from("ssol_profiles").select("name, gender").eq("id", userId).maybeSingle(),
    admin
      .from("ssol_quiz_results")
      .select("user_name, gender")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("user_onboarding").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const nickname = profile?.nickname ?? profile?.display_name ?? ssolProfile?.name ?? quizResult?.user_name ?? null;
  const gender = ssolProfile?.gender ?? quizResult?.gender ?? null;

  return NextResponse.json({
    completed: onboarding?.status === "completed",
    nickname,
    title: titleFor(gender),
    resumeStep: onboarding?.current_step ?? 0,
    answers: onboarding
      ? {
          relationship_status: onboarding.relationship_status,
          dating_interest: onboarding.dating_interest,
          relationship_stage: onboarding.relationship_stage,
          childcare_status: onboarding.childcare_status,
          child_age_groups: onboarding.child_age_groups,
          primary_activity: onboarding.primary_activity,
          values_ranked: onboarding.values_ranked,
          hobbies_ranked: onboarding.hobbies_ranked,
          weekends_ranked: onboarding.weekends_ranked,
          focus_domains: onboarding.focus_domains,
          daily_time: onboarding.daily_time,
          excluded_activities: onboarding.excluded_activities,
          other_answers: onboarding.other_answers ?? {},
        }
      : {},
  });
}

// 문항 하나 답(또는 건너뛰기=null)을 즉시 저장한다. 스펙 4.2: "기타"는 공백 제외 10자 이상이어야
// 서버에서도 통과 — 클라이언트 검증을 우회해도 여기서 다시 막는다.
export async function PATCH(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { questionId?: unknown; value?: unknown; otherText?: unknown; step?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  if (!ANSWER_COLUMNS.has(questionId)) {
    return NextResponse.json({ error: "알 수 없는 문항입니다." }, { status: 400 });
  }

  // "기타"가 포함된 응답인지 확인하고, 포함됐다면 서버에서도 글자 수를 검증한다.
  // 단일/복수 선택: value가 "other" 문자열이거나 배열에 "other"를 포함.
  // 순위 선택: value가 [{key, rank, other_text}] 배열이고 key="other"인 항목의 other_text.
  const value = body.value;
  const otherText = typeof body.otherText === "string" ? body.otherText : "";
  const includesOther =
    value === OTHER_CODE ||
    (Array.isArray(value) &&
      value.some((v) => v === OTHER_CODE || (v && typeof v === "object" && "key" in v && v.key === OTHER_CODE)));
  if (includesOther && !isOtherTextValid(otherText)) {
    return NextResponse.json({ error: "기타 내용을 공백 제외 10자 이상 작성해 주세요." }, { status: 400 });
  }

  const admin = createAdminClient();

  // other_answers는 jsonb 컬럼 하나에 문항별로 모아 저장 — 기존 값을 읽어서 병합한다.
  const updatePayload: Record<string, unknown> = { [questionId]: value ?? null };
  // 다음 문항 index를 current_step에 남겨서, 중간 이탈 후 재진입 시 이어서 보여줄 수 있게 한다.
  if (typeof body.step === "number") updatePayload.current_step = body.step + 1;
  if (includesOther && !Array.isArray(value)) {
    // 순위형이 아닌 문항의 기타 텍스트만 other_answers에 별도 저장한다(순위형은 항목 자체에 들어있음).
    const { data: existing } = await admin.from("user_onboarding").select("other_answers").eq("user_id", userId).maybeSingle();
    const merged = { ...((existing?.other_answers as Record<string, string>) ?? {}), [questionId]: otherText };
    updatePayload.other_answers = merged;
  }

  const { error } = await admin
    .from("user_onboarding")
    .upsert({ user_id: userId, ...updatePayload }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// 마지막 단계: 개인화 활용 동의와 함께 완료 처리. 동의 여부와 무관하게 완료로 표시한다
// (스펙 2.5: "동의하지 않아도 일반 AI 채팅을 사용할 수 있게 한다").
export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: { consent?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const consent = body.consent === true;

  const admin = createAdminClient();
  const { data: onboarding, error } = await admin
    .from("user_onboarding")
    .upsert(
      { user_id: userId, status: "completed", personalization_consent: consent, completed_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });

  // 기존 실천방법 추천(getDailyPractice)이 쓰는 profiles.enjoyment_category/concern_domain을
  // 새 답변으로 간이 매핑해둔다 — 375개 전체에 대한 정교한 하드 필터(스펙 6장)는 별도 작업이고,
  // 이건 그때까지 기존 개인화 기능이 완전히 죽지 않게 하는 임시 다리다.
  if (consent) {
    const legacy = deriveLegacyPreference(onboarding);
    if (legacy) await admin.from("profiles").update(legacy).eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
