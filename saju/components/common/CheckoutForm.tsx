"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Copy = { consent: string; consent_note: string; button: string; fail: string; success_wait: string };

// 결제 상자 아래 동의 한 줄 + 결제 버튼.
// - 카카오페이 키가 있으면(mode="kakaopay") 서버가 결제를 준비하고 돌려준 카카오페이 결제 화면으로 넘어간다.
//   결제가 끝나면 카카오페이가 /checkout/{id}/success/{쪽}으로 돌려보내고, 그 화면의 서버가 승인·금액을 확인한 뒤에만 결과를 연다.
// - 로컬 개발(mode="fake")은 개발용 가짜 결제. 운영에서는 꺼져 있다.
export default function CheckoutForm({
  id,
  page,
  copy,
  mode,
}: {
  id: string;
  page: number;
  copy: Copy;
  mode: "kakaopay" | "fake" | "off";
}) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "wait" | "fail">("idle");

  async function pay() {
    setState("wait");
    try {
      if (mode === "kakaopay") {
        const r = await fetch("/api/kakaopay/ready", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, page }),
        });
        const j = await r.json();
        if (j.next) return router.replace(j.next); // 이미 결제된 결과
        if (!r.ok || typeof j.redirect !== "string") throw new Error();
        window.location.href = j.redirect; // 카카오페이 결제 화면(서버가 https 주소인지 확인함)
        return;
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
