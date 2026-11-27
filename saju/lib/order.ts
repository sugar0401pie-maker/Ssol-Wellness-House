// 토스 주문 번호 ↔ 결과 번호(순수 함수 — order.test.ts).
// 토스 orderId 규칙: 영문 대소문자·숫자·-·_·= 만, 6~64자, 결제마다 달라야 한다.
// 모양: {결과 번호(UUID)}_{무작위 8자} → 43자. 승인할 때 결과 번호를 꺼내 어느 결과를 열지 정한다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function makeOrderId(resultId: string, rand: string): string {
  if (!UUID.test(resultId)) throw new Error("bad result id");
  const r = rand.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  if (r.length < 4) throw new Error("bad random");
  return `${resultId}_${r}`;
}

export function resultIdOfOrder(orderId: unknown): string | null {
  if (typeof orderId !== "string" || orderId.length < 6 || orderId.length > 64 || !/^[A-Za-z0-9_=-]+$/.test(orderId)) return null;
  const id = orderId.split("_")[0];
  return UUID.test(id) ? id : null;
}

/** 토스 고객 키: 22자 이상, -·_ 등 특수문자 포함, 추측하기 어려운 값. 로그인 연결 전이라 결과 번호로 만든다. */
export const customerKeyOf = (resultId: string) => `saju-${resultId}`;
