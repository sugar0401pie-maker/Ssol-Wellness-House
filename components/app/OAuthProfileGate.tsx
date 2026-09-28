"use client";

import { useState } from "react";
import { completeOAuthProfile } from "@/lib/supabase/authClient";
import { openAddressSearch } from "@/lib/address/daumPostcode";

// 2026-09-28 신설: 카카오/네이버로 가입한 사람은 이메일 회원가입(LoginScreen의 signup 모드)과
// 달리 이름·생년월일을 직접 입력받는 절차가 없어서 profiles에 그 정보가 비어 있었다 — 홈
// 인사말에 닉네임이 안 나오고, 카카오는 Supabase에 생일 정보를 아예 안 넘겨준다는 것까지
// 확인함(owner에게 캡처로 확인받은 실제 카카오 계정 데이터 기준). 그래서 회원가입 화면과
// 비슷한 모양으로, 로그인 직후 딱 한 번 필수 정보를 채우게 한다 — 이메일·비밀번호·인증번호
// 단계만 없다(OAuth 세션이 이미 있어서 불필요). AppFrame이 온보딩 게이트보다 먼저 띄운다.
export default function OAuthProfileGate({
  suggestedName,
  onDone,
}: {
  suggestedName: string | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(suggestedName ?? "");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSensitive, setAgreeSensitive] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !!birthDate && agreeTerms && agreeSensitive;

  async function handleAddressSearch() {
    try {
      const result = await openAddressSearch();
      setAddress(`(${result.zonecode}) ${result.address}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색을 열지 못했어요.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await completeOAuthProfile({
      displayName: name.trim(),
      birthDate,
      nickname: nickname.trim(),
      phone: phone.trim(),
      address: addressDetail.trim() ? `${address} ${addressDetail.trim()}` : address,
      marketingConsent: agreeMarketing,
      agreeTerms,
      agreeSensitive,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "저장 중 문제가 생겼어요.");
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <p className="font-serif text-[18px] font-bold text-foreground">몇 가지만 더 알려주세요</p>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          카카오·네이버 계정으로는 확인되지 않는 정보예요. 서비스 이용을 위해 한 번만 입력해주시면 돼요.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5">
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
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="휴대전화번호 (선택)"
            autoComplete="tel"
            className="h-11 rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
          />
          <div className="flex gap-1.5">
            <input
              type="text"
              value={address}
              readOnly
              placeholder="주소 (선택)"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-background px-4 text-[15px] text-foreground outline-none"
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
              <a href="/legal#privacy" target="_blank" rel="noreferrer" className="text-navy underline">
                개인정보 처리방침
              </a>
              과{" "}
              <a href="/legal#terms" target="_blank" rel="noreferrer" className="text-navy underline">
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
              <a href="/legal#sensitive" target="_blank" rel="noreferrer" className="text-navy underline">
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
            disabled={!canSubmit || submitting}
            className="mt-1 h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "저장하는 중…" : "완료"}
          </button>
        </form>
      </div>
    </div>
  );
}
