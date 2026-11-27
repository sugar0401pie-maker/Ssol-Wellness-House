import "server-only";

// 토스페이먼츠 결제 승인(서버 전용). 비밀 키는 TOSS_SECRET_KEY(Vercel 환경 변수)에만 둔다 — 화면으로 보내지 않는다.
// 결제창(API 개별 연동 키: test_ck/live_ck + test_sk/live_sk)을 쓴다. 승인은 결제 인증 뒤 10분 안에 해야 한다.
// 승인 응답의 status가 "DONE"이고 금액이 우리가 정한 금액과 같을 때만 결제 완료로 본다.

export const tossEnabled = () => Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY);

export type ConfirmResult = { ok: true; paymentKey: string; orderId: string; amount: number } | { ok: false; code: string; message: string };

export async function confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<ConfirmResult> {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return { ok: false, code: "NO_KEY", message: "결제 설정이 아직 끝나지 않았어요." };
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, // 비밀 키 뒤 콜론(:)을 빼면 안 됨
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, code: String(j.code ?? res.status), message: String(j.message ?? "결제 승인에 실패했어요.") };
    if (j.status !== "DONE" || Number(j.totalAmount ?? amount) !== amount) {
      return { ok: false, code: "NOT_DONE", message: "결제가 끝나지 않았어요." };
    }
    return { ok: true, paymentKey, orderId, amount };
  } catch {
    return { ok: false, code: "NETWORK", message: "결제 승인 중 연결이 끊겼어요." };
  }
}
