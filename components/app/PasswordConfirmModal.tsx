"use client";

import { useState } from "react";
import { signInWithEmail } from "@/lib/supabase/authClient";

// 2026-09-25 owner 요청: 개인정보 보호 목적으로, 내 정보 수정 화면을 열기 전에 비밀번호를
// 한 번 더 확인한다. Supabase는 "지금 세션 유지한 채 비밀번호만 검증"하는 별도 API가 없어서,
// signInWithPassword를 다시 호출하는 것으로 확인한다 — 성공하면 같은 계정으로 세션이 갱신될
// 뿐이라 안전하다.
export default function PasswordConfirmModal({
  email,
  onConfirmed,
  onCancel,
}: {
  email: string;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "비밀번호를 확인해주세요.");
      return;
    }
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
        <p className="text-[15px] font-medium leading-6 text-foreground">비밀번호 확인</p>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          개인정보 보호를 위해 정보를 수정하기 전 비밀번호를 다시 확인할게요.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
          />
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!password || submitting}
            className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "확인하는 중…" : "확인"}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting} className="h-9 text-[13px] text-slate-500">
            취소
          </button>
        </form>
      </div>
    </div>
  );
}
