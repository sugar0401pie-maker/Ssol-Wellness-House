"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmail, signUpWithEmail, signInWithOAuth } from "@/lib/supabase/authClient";

// 로그인 전(초기) 화면. 소개 문구는 ssolwellness.com 첫 화면 문구를 그대로 가져왔다 —
// owner의 기존 서비스 소개 사이트와 같은 문구라 새로 쓰지 않았다 (2026-09-22).
export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const result =
      mode === "signin" ? await signInWithEmail(email.trim(), password) : await signUpWithEmail(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "문제가 생겼어요. 다시 시도해주세요.");
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice("가입 메일함을 확인해서 인증을 완료해주세요. 인증 후 로그인할 수 있어요.");
      return;
    }
    onLoggedIn();
  }

  async function handleOAuth(provider: "kakao" | "naver") {
    setError(null);
    const result = await signInWithOAuth(provider);
    if (!result.ok) setError(result.error ?? "로그인 중 문제가 생겼어요.");
    // 성공하면 페이지가 provider 로그인 화면으로 이동하므로 여기서 할 일이 없다.
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-y-auto bg-background px-6 py-10">
      <div className="w-full max-w-xs">
        <Image src="/logo.jpg" alt="쏠 웰니스 하우스" width={832} height={180} className="mx-auto h-9 w-auto" />

        <div className="mt-6 text-center">
          <p className="text-[13px] font-medium tracking-wide text-navy">당신을 위한 프리미엄 멘탈 웰니스 서비스</p>
          <p className="mt-4 text-[17px] font-medium leading-7 text-foreground">
            이유 없는 불안의 다스림,
            <br />
            삶과 진로에 대한 확신이 필요하신가요?
          </p>
          <p className="mt-3 text-[14px] leading-6 text-slate-500">
            성공과 행복 그 이상의 당신을 찾아드립니다.
            <br />
            쏠 웰니스 하우스에 오신 것을 환영합니다.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex rounded-xl bg-background p-1 text-[13px] font-medium">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-1.5 ${mode === "signin" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-1.5 ${mode === "signup" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              autoComplete="email"
              className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
            />
            {error && <p className="text-[13px] text-red-600">{error}</p>}
            {notice && <p className="text-[13px] text-navy">{notice}</p>}
            <button
              type="submit"
              disabled={!email.trim() || !password || submitting}
              className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? "확인하는 중…" : mode === "signin" ? "로그인" : "회원가입"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-slate-400">또는</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleOAuth("kakao")}
              className="h-11 rounded-xl bg-[#FEE500] text-sm font-medium text-[#191600]"
            >
              카카오로 로그인
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("naver")}
              className="h-11 rounded-xl bg-[#03C75A] text-sm font-medium text-white"
            >
              네이버로 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
