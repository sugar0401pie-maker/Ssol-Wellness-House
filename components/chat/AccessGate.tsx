"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getStoredAccessCode, setStoredAccessCode } from "@/lib/security/accessCodeClient";

// ACCESS_CODE가 서버에 설정돼 있지 않으면(로컬 개발) /api/access가 항상 ok를 주므로
// 이 화면은 거의 즉시 지나가고 평소처럼 채팅 화면이 보인다.
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function verify(candidate: string | null) {
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: candidate }),
      });
      const data = (await res.json()) as { ok: boolean };
      setStatus(data.ok ? "unlocked" : "locked");
    } catch {
      // 확인 자체가 실패하면(네트워크 문제 등) 일단 잠긴 화면을 보여준다 — 안전하게 실패
      setStatus("locked");
    }
  }

  useEffect(() => {
    // 마운트 시 1회, 저장된 코드로 서버 확인. setState는 verify 내부의 await 이후(비동기)에만 일어난다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 확인하는 표준 데이터 패칭 패턴
    void verify(getStoredAccessCode());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setStoredAccessCode(code);
        setStatus("unlocked");
      } else {
        setError("코드가 올바르지 않아요.");
      }
    } catch {
      setError("확인 중 문제가 생겼어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") return null;
  if (status === "unlocked") return <>{children}</>;

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs">
        <Image src="/logo.jpg" alt="쏠 웰니스 하우스" width={832} height={180} className="mx-auto mb-6 h-8 w-auto" />
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[15px] font-medium leading-6 text-foreground">접속 코드를 입력해주세요</p>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            aria-label="접속 코드"
            className="mt-3 h-11 w-full rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
          />
          {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || submitting}
            className="mt-3 h-11 w-full rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "확인하는 중…" : "확인"}
          </button>
        </form>
      </div>
    </div>
  );
}
