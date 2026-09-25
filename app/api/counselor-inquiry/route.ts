import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromAuthHeader } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAccessCode } from "@/lib/security/accessCode";
import { sendEmail } from "@/lib/email/resend";
import {
  PROGRAMS,
  TIME_SLOTS,
  AGE_RANGES,
  GENDER_OPTIONS,
  REFERRAL_SOURCES,
  MIN_PREFERRED_TIMES,
  MAX_PREFERRED_TIMES,
} from "@/lib/counselor/booking";

// 2026-09-25: ssolwellnesshouse.com 실제 예약 페이지와 같은 내용의 신청서로 확장.
// 아직 실시간 캘린더 연동이 없어서 "가능한 시간 2~3개"를 후보로 받고, 관리자에게 이메일로
// 알린 뒤(설정돼 있으면) DB에도 저장해서 나중에 확인할 수 있게 한다.
export const runtime = "nodejs";

const NOTIFY_EMAIL = process.env.COUNSELOR_NOTIFY_EMAIL ?? "junseok@ssolwellness.com";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  if (!checkAccessCode(req.headers.get("x-access-code"))) {
    return NextResponse.json({ error: "접속 코드가 올바르지 않습니다." }, { status: 403 });
  }
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const name = str(body.name, 50);
  const phone = str(body.phone, 30);
  const email = str(body.email, 100);
  const ageRange = str(body.ageRange, 20);
  const gender = str(body.gender, 20);
  const referralSource = str(body.referralSource, 20);
  const program = str(body.program, 30);
  const preferredDate = str(body.preferredDate, 10);
  const message = str(body.message, 1000);
  const otherAvailability = str(body.otherAvailability, 500);
  const agreed = body.agreed === true;
  const preferredTimes = Array.isArray(body.preferredTimes)
    ? body.preferredTimes.filter((t): t is string => typeof t === "string" && TIME_SLOTS.includes(t))
    : [];

  if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "연락처를 입력해주세요." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
  if (!AGE_RANGES.includes(ageRange as (typeof AGE_RANGES)[number])) {
    return NextResponse.json({ error: "나이를 선택해주세요." }, { status: 400 });
  }
  if (!GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number])) {
    return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
  }
  if (!REFERRAL_SOURCES.includes(referralSource as (typeof REFERRAL_SOURCES)[number])) {
    return NextResponse.json({ error: "어떻게 알고 오셨는지 선택해주세요." }, { status: 400 });
  }
  if (!PROGRAMS.some((p) => p.id === program)) {
    return NextResponse.json({ error: "프로그램을 선택해주세요." }, { status: 400 });
  }
  if (!DATE_RE.test(preferredDate)) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }
  if (preferredTimes.length < MIN_PREFERRED_TIMES || preferredTimes.length > MAX_PREFERRED_TIMES) {
    return NextResponse.json(
      { error: `가능한 시간을 ${MIN_PREFERRED_TIMES}~${MAX_PREFERRED_TIMES}개 선택해주세요.` },
      { status: 400 },
    );
  }
  if (!message) return NextResponse.json({ error: "문의사항을 입력해주세요." }, { status: 400 });
  if (!otherAvailability) {
    return NextResponse.json({ error: "다른 가능한 시간대를 입력해주세요." }, { status: 400 });
  }
  if (!agreed) return NextResponse.json({ error: "개인정보 수집·이용에 동의해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("counselor_inquiries")
    .insert({
      user_id: userId,
      contact: `${phone} / ${email}`, // 예전 컬럼(하위 호환) — 새 phone/email 컬럼과 함께 채워둠
      message,
      name,
      phone,
      email,
      age_range: ageRange,
      gender,
      referral_source: referralSource,
      program,
      preferred_date: preferredDate,
      preferred_times: preferredTimes,
      other_availability: otherAvailability,
      agreed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "신청 접수에 실패했어요." }, { status: 500 });

  const emailBody = [
    `새 상담 예약 신청이 접수됐어요.`,
    ``,
    `프로그램: ${program}`,
    `날짜: ${preferredDate}`,
    `가능한 시간(후보): ${preferredTimes.join(", ")}`,
    ``,
    `이름: ${name}`,
    `연락처: ${phone}`,
    `이메일: ${email}`,
    `나이: ${ageRange} / 성별: ${gender}`,
    `유입경로: ${referralSource}`,
    ``,
    `문의사항: ${message}`,
    `다른 가능한 시간대: ${otherAvailability}`,
  ].join("\n");

  const sent = await sendEmail({ to: NOTIFY_EMAIL, subject: `[쏠 웰니스] 상담 예약 신청 - ${name}`, text: emailBody });
  if (sent) {
    await admin.from("counselor_inquiries").update({ notified_at: new Date().toISOString() }).eq("id", inserted.id);
  }

  return NextResponse.json({ ok: true });
}
