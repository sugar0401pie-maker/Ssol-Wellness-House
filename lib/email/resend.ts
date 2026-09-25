import "server-only";

// Resend REST API를 직접 호출하는 아주 작은 헬퍼. SDK를 새로 추가하지 않고 fetch만 쓴다.
// RESEND_API_KEY가 아직 설정되지 않았으면(2026-09-25 기준 owner가 아직 발급 전) 조용히
// 건너뛴다 — 이메일 발송은 부가 기능이라 실패해도 신청 자체(DB 저장)는 막지 않는다
// (CLAUDE.md fail-safe 원칙과 별개로, 이건 "덜 위험한 쪽"이 이메일을 못 보내는 쪽이라 그렇게 함).
//
// owner가 할 일: resend.com에서 API 키를 발급받아 .env.local과 Vercel 환경변수에
// RESEND_API_KEY로 추가하면 된다. 보내는 주소(FROM_EMAIL)는 이미 Supabase Auth 메일에
// 쓰고 있는 인증된 도메인 주소를 그대로 재사용한다(같은 Resend 계정이라고 가정 — 다르면
// 그 도메인을 이 Resend 계정에도 인증해야 한다).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "SSOL 웰니스 하우스 <noreply@ssolwellnesshouse.com>";

// reason은 실패 원인을 서버 로그(console.error)와 호출부에 함께 남기기 위한 용도다.
export async function sendEmail(
  params: { to: string; subject: string; text: string },
): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY가 설정되지 않아 이메일 발송을 건너뜁니다:", params.subject);
    return { ok: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [params.to], subject: params.subject, text: params.text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend 발송 실패:", res.status, body);
      return { ok: false, reason: `status_${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Resend 호출 중 오류:", msg);
    return { ok: false, reason: `exception: ${msg}` };
  }
}
