import "server-only";

// 개발용 가짜 결제를 켤지. 실제 결제(토스)를 연결하기 전까지 로컬에서 유료 쪽을 확인하는 용도.
// 운영(Vercel)에서는 SAJU_FAKE_PAYMENT=1을 일부러 켜지 않는 한 꺼져 있다.
export const fakePaymentEnabled = () =>
  process.env.SAJU_FAKE_PAYMENT === "1" || (process.env.NODE_ENV !== "production" && !process.env.VERCEL);
