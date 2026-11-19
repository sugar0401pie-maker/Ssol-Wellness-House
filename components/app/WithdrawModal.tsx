"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { signOut } from "@/lib/supabase/authClient";
import { WITHDRAW_DETAILS, WITHDRAW_DONE_TEXT, withdrawNotice } from "@/lib/account/withdrawPlan";

// 회원 탈퇴 팝업(2026-11-19 대표님 요청) — 안내 → "탈퇴하겠습니다" → 완료 안내 → 로그아웃.
// 지우는 범위는 쏘웰라 정보만(lib/account/withdrawPlan.ts). 모든 팝업처럼 오른쪽 위에 닫기 버튼(완료 뒤 닫기도 로그아웃으로 이어짐).
export default function WithdrawModal({ nickname, onClose }: { nickname: string | null; onClose: () => void }) {
  const [step, setStep] = useState<"confirm" | "working" | "done">("confirm");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function withdraw() {
    setStep("working");
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("로그인 정보를 확인하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
      const res = await fetch("/api/account/withdraw", { method: "POST", headers: authHeaders(token) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "탈퇴 처리 중 문제가 생겼어요.");
      try {
        localStorage.removeItem("ssol_active_chat_session"); // 이어 보던 대화 번호(이미 지워진 대화)
      } catch {
        // 못 지워도 지워진 대화는 열리지 않는다.
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "탈퇴 처리 중 문제가 생겼어요.");
      setStep("confirm");
    }
  }

  async function finish() {
    await signOut().catch(() => undefined);
    router.push("/"); // 로그아웃되면 첫 화면(로그인)이 보인다
  }

  const close = step === "done" ? () => void finish() : step === "working" ? () => undefined : onClose;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-[15px] font-medium text-foreground">회원 탈퇴</p>
          <button type="button" onClick={close} disabled={step === "working"} className="text-[13px] text-slate-400 disabled:opacity-40">
            닫기
          </button>
        </div>
        <div className="px-5 py-5 text-[14px] leading-6">
          {step === "done" ? (
            <div className="py-4 text-center">
              <p className="text-foreground">{WITHDRAW_DONE_TEXT}</p>
              <button type="button" onClick={() => void finish()} className="mt-5 h-10 rounded-xl bg-navy px-5 text-[14px] font-medium text-white">
                확인
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-foreground">{withdrawNotice(nickname)}</p>
              <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-slate-600">
                {WITHDRAW_DETAILS.map((d) => (
                  <li key={d} className="flex gap-1.5">
                    <span aria-hidden>·</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
              <button
                type="button"
                onClick={() => void withdraw()}
                disabled={step === "working"}
                className="mt-5 h-11 w-full rounded-xl bg-red-600 text-[14px] font-medium text-white disabled:opacity-40"
              >
                {step === "working" ? "처리하는 중…" : "탈퇴하겠습니다"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
