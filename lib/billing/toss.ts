import "server-only";

// 토스페이먼츠 결제 승인(confirm) API를 직접 호출하는 작은 헬퍼. 시크릿 키는 여기(서버)에서만
// 쓰고, Basic 인증 형식(시크릿키 뒤에 콜론만 붙여 base64)은 토스 공식 문서 그대로다.
// 절대 클라이언트로 시크릿 키가 넘어가면 안 된다 — TOSS_SECRET_KEY는 NEXT_PUBLIC_이 아니다.
export type TossConfirmResult =
  | { ok: true; totalAmount: number; method: string | null }
  | { ok: false; error: string };

export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResult> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return { ok: false, error: "결제 연동이 아직 설정되지 않았어요." };

  const auth = Buffer.from(`${secretKey}:`).toString("base64");
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body?.message ?? `토스 결제 승인에 실패했어요 (${res.status}).` };
    }
    return { ok: true, totalAmount: body.totalAmount, method: body.method ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "결제 승인 중 오류가 발생했어요." };
  }
}

// 이용권 종류별 만료일 계산 — 결제 승인 성공 시점(now) 기준.
export function computeExpiryFor(plan: "monthly" | "annual", now: Date): Date {
  const expires = new Date(now);
  if (plan === "monthly") expires.setMonth(expires.getMonth() + 1);
  else expires.setFullYear(expires.getFullYear() + 1);
  return expires;
}
