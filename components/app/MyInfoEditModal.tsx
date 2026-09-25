"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { requestEmailChange, verifyEmailChange } from "@/lib/supabase/authClient";
import { openAddressSearch } from "@/lib/address/daumPostcode";

export type MyInfo = {
  displayName: string | null;
  nickname: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  marketingConsent: boolean;
};

// 2026-09-25 owner 요청: 마이페이지 "내 정보 확인"을 개별 필드 편집 대신, 비밀번호 확인 후
// 열리는 하나의 통합 수정 화면으로 바꾼다. 이름/닉네임/생년월일/휴대전화번호/주소/마케팅
// 동의는 한 번에 저장하고, 이메일은 재인증(OTP)이 필요해 그 안에서도 별도 단계로 남긴다.
export default function MyInfoEditModal({
  info,
  onClose,
  onSaved,
}: {
  info: MyInfo;
  onClose: () => void;
  onSaved: (next: Partial<MyInfo>) => void;
}) {
  const [displayName, setDisplayName] = useState(info.displayName ?? "");
  const [nickname, setNickname] = useState(info.nickname ?? "");
  const [birthDate, setBirthDate] = useState(info.birthDate ?? "");
  const [phone, setPhone] = useState(info.phone ?? "");
  const [address, setAddress] = useState(info.address ?? "");
  const [addressDetail, setAddressDetail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(info.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [emailStep, setEmailStep] = useState<"idle" | "entering" | "verifying">("idle");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailCodeInput, setEmailCodeInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState(info.email ?? "");

  async function handleAddressSearch() {
    try {
      const result = await openAddressSearch();
      setAddress(`(${result.zonecode}) ${result.address}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색을 열지 못했어요.");
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setSaving(false);
      setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          displayName: displayName.trim(),
          nickname: nickname.trim(),
          birthDate: birthDate || undefined,
          phone: phone.trim(),
          address: addressDetail.trim() ? `${address} ${addressDetail.trim()}` : address,
          marketingConsent,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "저장에 실패했어요.");
      }
      setSaved(true);
      onSaved({
        displayName: displayName.trim() || info.displayName,
        nickname: nickname.trim() || null,
        birthDate: birthDate || info.birthDate,
        phone: phone.trim() || null,
        address: (addressDetail.trim() ? `${address} ${addressDetail.trim()}` : address) || null,
        marketingConsent,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestEmailChange() {
    const trimmed = newEmailInput.trim();
    if (!trimmed || emailSaving) return;
    setEmailSaving(true);
    setEmailError(null);
    const result = await requestEmailChange(trimmed);
    setEmailSaving(false);
    if (!result.ok) {
      setEmailError(result.error ?? "인증번호 발송에 실패했어요.");
      return;
    }
    setEmailStep("verifying");
  }

  async function handleConfirmEmailChange() {
    const trimmed = newEmailInput.trim();
    if (!emailCodeInput.trim() || emailSaving) return;
    setEmailSaving(true);
    setEmailError(null);
    const result = await verifyEmailChange(trimmed, emailCodeInput.trim());
    setEmailSaving(false);
    if (!result.ok) {
      setEmailError(result.error ?? "인증번호 확인에 실패했어요.");
      return;
    }
    setCurrentEmail(trimmed);
    onSaved({ email: trimmed });
    setEmailStep("idle");
    setNewEmailInput("");
    setEmailCodeInput("");
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-[15px] font-medium text-foreground">내 정보 수정</p>
          <button type="button" onClick={onClose} className="text-[13px] text-slate-400">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {saved ? (
            <div className="py-8 text-center">
              <p className="text-[15px] font-medium text-foreground">저장됐어요.</p>
              <button type="button" onClick={onClose} className="mt-5 h-10 rounded-xl bg-navy px-5 text-[14px] font-medium text-white">
                닫기
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-[14px]">
              <div>
                <p className="mb-1 text-slate-400">이름(실명)</p>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
              </div>
              <div>
                <p className="mb-1 text-slate-400">닉네임</p>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="비우면 이름이 표시돼요"
                  className="h-11 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
              </div>
              <div>
                <p className="mb-1 text-slate-400">생년월일</p>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
              </div>

              <div>
                <p className="mb-1 text-slate-400">이메일</p>
                {emailStep === "idle" ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate text-foreground">{currentEmail}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmailInput("");
                        setEmailError(null);
                        setEmailStep("entering");
                      }}
                      className="text-[12px] text-navy underline"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-400">{currentEmail}</p>
                )}
                {emailStep === "entering" && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-line p-2.5">
                    <p className="text-[12px] text-slate-500">새 이메일로 인증번호를 보내드려요.</p>
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      placeholder="새 이메일 주소"
                      className="h-9 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-navy"
                    />
                    {emailError && <p className="text-[12px] text-red-600">{emailError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRequestEmailChange()}
                        disabled={!newEmailInput.trim() || emailSaving}
                        className="h-8 flex-1 rounded-lg bg-navy text-[12px] font-medium text-white disabled:opacity-40"
                      >
                        {emailSaving ? "발송하는 중…" : "인증번호 받기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailStep("idle")}
                        className="h-8 rounded-lg border border-line px-3 text-[12px] text-slate-500"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
                {emailStep === "verifying" && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-line p-2.5">
                    <p className="text-[12px] text-slate-500">{newEmailInput}(으)로 인증번호를 보냈어요.</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={emailCodeInput}
                      onChange={(e) => setEmailCodeInput(e.target.value)}
                      placeholder="인증번호 입력"
                      className="h-9 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-navy"
                    />
                    {emailError && <p className="text-[12px] text-red-600">{emailError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleConfirmEmailChange()}
                        disabled={!emailCodeInput.trim() || emailSaving}
                        className="h-8 flex-1 rounded-lg bg-navy text-[12px] font-medium text-white disabled:opacity-40"
                      >
                        {emailSaving ? "확인하는 중…" : "인증번호 확인"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailStep("idle")}
                        className="h-8 rounded-lg border border-line px-3 text-[12px] text-slate-500"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-slate-400">휴대전화번호</p>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="h-11 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
                <p className="mt-1 text-[11px] text-slate-400">아직 문자 인증은 지원하지 않아 입력만 저장돼요.</p>
              </div>

              <div>
                <p className="mb-1 text-slate-400">주소</p>
                <div className="flex gap-1.5">
                  <input
                    value={address}
                    readOnly
                    placeholder="도로명 주소 검색"
                    className="h-11 flex-1 rounded-xl border border-line bg-background px-3 text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddressSearch()}
                    className="h-11 shrink-0 rounded-xl border border-navy px-3 text-[13px] font-medium text-navy"
                  >
                    주소 검색
                  </button>
                </div>
                <input
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="상세주소 (동/호수 등)"
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
              </div>

              <label className="flex items-start gap-2 text-[13px] leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>(선택) 마케팅 정보 활용에 동의합니다.</span>
              </label>

              {error && <p className="text-[13px] text-red-600">{error}</p>}

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-11 rounded-xl bg-navy text-[14px] font-medium text-white disabled:opacity-40"
              >
                {saving ? "저장하는 중…" : "저장"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
