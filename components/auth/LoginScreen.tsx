"use client";

import { useState } from "react";
import Image from "next/image";
import {
  signInWithEmail,
  signInWithOAuth,
  sendSignupOtp,
  verifySignupOtp,
  finishSignup,
} from "@/lib/supabase/authClient";
import { openAddressSearch } from "@/lib/address/daumPostcode";

// 로그인 전(초기) 화면. 소개 문구는 ssolwellness.com 첫 화면 문구를 그대로 가져왔다 (2026-09-22).
// 회원가입 화면은 ssolwellnesshouse.com 실제 가입 화면(이름·생년월일 입력 → 인증번호 받기 →
// 인증번호+비밀번호 입력 → 약관 동의 → 가입 완료)과 같은 구조로 맞췄다 (2026-09-23).
// 휴대폰 인증은 SMS 발송 업체 연동이 아직 없어(PLAN.md 7-9 참고) 이메일 인증번호만 지원한다.
type Mode = "signin" | "signup";
type SignupStep = "info" | "verify";

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");

  // 로그인
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 회원가입
  const [step, setStep] = useState<SignupStep>("info");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSensitive, setAgreeSensitive] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  function backToInfoStep() {
    setStep("info");
    setOtpCode("");
    setSignupPassword("");
    setError(null);
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await signInWithEmail(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "문제가 생겼어요. 다시 시도해주세요.");
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

  const canSendOtp = name.trim() && birthDate && signupEmail.trim() && agreeTerms && agreeSensitive;

  async function handleAddressSearch() {
    try {
      const result = await openAddressSearch();
      setAddress(`(${result.zonecode}) ${result.address}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색을 열지 못했어요.");
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!canSendOtp || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await sendSignupOtp(signupEmail.trim(), { display_name: name.trim(), birth_date: birthDate });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "인증번호 발송에 실패했어요.");
      return;
    }
    setNotice(null);
    setStep("verify");
  }

  const passwordChecks = {
    length: signupPassword.length >= 8,
    upper: /[A-Z]/.test(signupPassword),
    special: /[^A-Za-z0-9]/.test(signupPassword),
  };
  const passwordValid = passwordChecks.length && passwordChecks.upper && passwordChecks.special;
  const canCompleteSignup = otpCode.trim().length > 0 && passwordValid;

  async function handleCompleteSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!canCompleteSignup || submitting) return;
    setSubmitting(true);
    setError(null);
    const verify = await verifySignupOtp(signupEmail.trim(), otpCode.trim());
    if (!verify.ok) {
      setSubmitting(false);
      setError(verify.error ?? "인증에 실패했어요.");
      return;
    }
    const finish = await finishSignup({
      password: signupPassword,
      displayName: name.trim(),
      birthDate,
      nickname: nickname.trim(),
      phone: phone.trim(),
      address: addressDetail.trim() ? `${address} ${addressDetail.trim()}` : address,
      marketingConsent: agreeMarketing,
    });
    setSubmitting(false);
    if (!finish.ok) {
      setError(finish.error ?? "가입 완료 중 문제가 생겼어요.");
      return;
    }
    onLoggedIn();
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-y-auto bg-background px-6 py-10">
      <div className="w-full max-w-xs">
        <Image src="/logo.jpg" alt="쏠 웰니스 하우스" width={832} height={180} className="mx-auto h-9 w-auto" />

        {mode === "signin" && (
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
        )}

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => (step === "verify" ? backToInfoStep() : switchMode("signin"))}
              className="mb-3 text-[13px] text-slate-500"
            >
              ← 뒤로
            </button>
          )}

          {mode === "signin" && (
            <>
              <div className="mb-4 flex rounded-xl bg-background p-1 text-[13px] font-medium">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="flex-1 rounded-lg bg-white py-1.5 text-navy shadow-sm"
                >
                  로그인
                </button>
                <button type="button" onClick={() => switchMode("signup")} className="flex-1 rounded-lg py-1.5 text-slate-500">
                  회원가입
                </button>
              </div>

              <form onSubmit={handleSignin} className="flex flex-col gap-2.5">
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
                  autoComplete="current-password"
                  className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
                />
                {error && <p className="text-[13px] text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!email.trim() || !password || submitting}
                  className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
                >
                  {submitting ? "확인하는 중…" : "로그인"}
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
            </>
          )}

          {mode === "signup" && step === "info" && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-2.5">
              <p className="text-[16px] font-medium text-foreground">계정 만들기</p>
              <p className="mb-1 text-[13px] text-slate-500">본인 확인 후 가입할게요</p>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 (실명)"
                autoComplete="name"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임 (선택, 비우면 이름이 표시돼요)"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                aria-label="생년월일"
                max={new Date().toISOString().slice(0, 10)}
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] text-foreground outline-none focus:border-navy"
              />
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="이메일"
                autoComplete="email"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="휴대전화번호 (선택)"
                autoComplete="tel"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
              <p className="text-[12px] text-slate-400">휴대폰 번호 인증은 준비 중이에요. 지금은 이메일로 가입해주세요.</p>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={address}
                  readOnly
                  placeholder="주소 (선택)"
                  className="h-11 flex-1 rounded-xl border border-line bg-background px-4 text-[15px] text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleAddressSearch()}
                  className="h-11 shrink-0 rounded-xl border border-navy px-3 text-[13px] font-medium text-navy"
                >
                  주소 검색
                </button>
              </div>
              {address && (
                <input
                  type="text"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="상세주소 (동/호수 등)"
                  className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
                />
              )}

              <label className="mt-1 flex items-start gap-2 text-[12px] leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  <a href="https://ssolwellnesshouse.com/privacy" target="_blank" rel="noreferrer" className="text-navy underline">
                    개인정보 처리방침
                  </a>
                  과{" "}
                  <a href="https://ssolwellnesshouse.com/terms" target="_blank" rel="noreferrer" className="text-navy underline">
                    이용약관
                  </a>
                  , 일부 개인 데이터의 국외이전에 동의합니다. (필수)
                </span>
              </label>
              <label className="flex items-start gap-2 text-[12px] leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={agreeSensitive}
                  onChange={(e) => setAgreeSensitive(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  테스트 응답 등{" "}
                  <a
                    href="https://ssolwellnesshouse.com/privacy/sensitive"
                    target="_blank"
                    rel="noreferrer"
                    className="text-navy underline"
                  >
                    민감정보의 수집·이용
                  </a>
                  에 동의합니다. (필수)
                </span>
              </label>
              <label className="flex items-start gap-2 text-[12px] leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={agreeMarketing}
                  onChange={(e) => setAgreeMarketing(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>(선택) 마케팅 정보 활용에 동의합니다.</span>
              </label>

              {error && <p className="text-[13px] text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={!canSendOtp || submitting}
                className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
              >
                {submitting ? "발송하는 중…" : "인증번호 받기"}
              </button>
            </form>
          )}

          {mode === "signup" && step === "verify" && (
            <form onSubmit={handleCompleteSignup} className="flex flex-col gap-2.5">
              <p className="text-[16px] font-medium text-foreground">인증번호를 입력해주세요</p>
              <p className="mb-1 text-[13px] text-slate-500">{signupEmail}로 보내드렸어요.</p>

              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="인증번호"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] tracking-widest outline-none focus:border-navy"
              />
              <input
                type="password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="비밀번호"
                autoComplete="new-password"
                className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
              <ul className="flex flex-col gap-0.5 text-[12px] leading-5">
                <li className={passwordChecks.length ? "text-navy" : "text-slate-400"}>
                  {passwordChecks.length ? "●" : "○"} 8자 이상
                </li>
                <li className={passwordChecks.upper ? "text-navy" : "text-slate-400"}>
                  {passwordChecks.upper ? "●" : "○"} 대문자 1자 이상
                </li>
                <li className={passwordChecks.special ? "text-navy" : "text-slate-400"}>
                  {passwordChecks.special ? "●" : "○"} 특수문자 1자 이상
                </li>
              </ul>

              {error && <p className="text-[13px] text-red-600">{error}</p>}
              {notice && <p className="text-[13px] text-navy">{notice}</p>}
              <button
                type="submit"
                disabled={!canCompleteSignup || submitting}
                className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
              >
                {submitting ? "확인하는 중…" : "가입 완료"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
