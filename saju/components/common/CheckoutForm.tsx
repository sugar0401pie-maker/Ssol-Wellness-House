"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Copy = { consent: string; consent_note: string; button: string; fail: string; success_wait: string };

// 결제 상자 아래 동의 한 줄 + 결제 버튼. 지금은 개발용 가짜 결제(/api/checkout/{id})만 있다 — 토스 연결 때 이 버튼이 토스 결제창을 연다.
export default function CheckoutForm({ id, page, copy, enabled }: { id: string; page: number; copy: Copy; enabled: boolean }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "wait" | "fail">("idle");

  async function pay() {
    setState("wait");
    try {
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
      {enabled ? (
        <button className="btn gold" disabled={!agree || state === "wait"} onClick={pay}>
          {state === "wait" ? copy.success_wait : copy.button}
        </button>
      ) : (
        <p className="err">결제 연결 준비 중이에요.</p>
      )}
      {!enabled ? null : <p className="hint center">개발용 테스트 결제 — 실제로 돈이 나가지 않아요.</p>}
      {state === "fail" && <p className="err">{copy.fail}</p>}
    </>
  );
}
