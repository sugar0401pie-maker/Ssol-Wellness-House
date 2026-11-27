"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Copy = { consent: string; consent_note: string; button: string; fail: string; success_wait: string };
type Toss = { clientKey: string; customerKey: string; orderId: string; orderName: string; amount: number };

// 결제 상자 아래 동의 한 줄 + 결제 버튼.
// - 토스 키가 있으면(mode="toss") 토스 결제창을 연다. 결제가 끝나면 토스가 /checkout/{id}/success로 돌려보내고,
//   그 화면의 서버가 승인 API로 금액·상태를 확인한 뒤에만 결제 완료로 기록한다(브라우저 말만 믿지 않음).
// - 로컬 개발(mode="fake")은 개발용 가짜 결제. 운영에서는 꺼져 있다.
const SDK = "https://js.tosspayments.com/v2/standard";

type TossSDK = (key: string) => {
  payment: (o: { customerKey: string }) => { requestPayment: (o: Record<string, unknown>) => Promise<void> };
};

function loadToss(): Promise<TossSDK> {
  const w = window as unknown as { TossPayments?: TossSDK };
  if (w.TossPayments) return Promise.resolve(w.TossPayments);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error("no sdk")));
    s.onerror = () => reject(new Error("sdk load failed"));
    document.head.appendChild(s);
  });
}

export default function CheckoutForm({
  id,
  page,
  copy,
  mode,
  toss,
}: {
  id: string;
  page: number;
  copy: Copy;
  mode: "toss" | "fake" | "off";
  toss: Toss | null;
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "wait" | "fail">("idle");

  async function pay() {
    setState("wait");
    try {
      if (mode === "toss" && toss) {
        const T = await loadToss();
        const origin = window.location.origin;
        await T(toss.clientKey)
          .payment({ customerKey: toss.customerKey })
          .requestPayment({
            method: "CARD",
            amount: { currency: "KRW", value: toss.amount },
            orderId: toss.orderId,
            orderName: toss.orderName,
            successUrl: `${origin}/checkout/${id}/success?page=${page}`,
            failUrl: `${origin}/checkout/${id}/fail?page=${page}`,
          });
        return; // 토스 결제창으로 넘어간다(돌아오는 곳은 success/fail 화면)
      }
      const r = await fetch(`/api/checkout/${id}`, { method: "POST" });
      if (!r.ok) throw new Error();
      router.replace(`/result/${id}/${page}?opened=1`);
    } catch {
      setState("fail");
    }
  }

  return (
    <>
      <label className="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        {copy.consent}
      </label>
      <p className="hint">{copy.consent_note}</p>
      {mode === "off" ? (
        <p className="err">결제 연결 준비 중이에요.</p>
      ) : (
        <button className="btn gold" disabled={!agree || state === "wait"} onClick={pay}>
          {state === "wait" ? copy.success_wait : copy.button}
        </button>
      )}
      {mode === "fake" && <p className="hint center">개발용 테스트 결제 — 실제로 돈이 나가지 않아요.</p>}
      {state === "fail" && <p className="err">{copy.fail}</p>}
    </>
  );
}
