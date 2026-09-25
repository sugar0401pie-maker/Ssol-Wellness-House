"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  PROGRAMS,
  TIME_SLOTS,
  AGE_RANGES,
  GENDER_OPTIONS,
  REFERRAL_SOURCES,
  MIN_PREFERRED_TIMES,
  MAX_PREFERRED_TIMES,
} from "@/lib/counselor/booking";

// 2026-09-25: ssolwellnesshouse.com 실제 예약 페이지와 같은 내용으로 만든 상담 신청 팝업.
// 아직 실시간 캘린더 연동 전이라(owner에게 별도 안내) 시간은 2~3개 후보로 받고, 관리자가
// 확인해서 하나로 확정해 다시 연락하는 방식으로 문구를 안내한다.
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CounselorBookingModal({ onClose }: { onClose: () => void }) {
  const [program, setProgram] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [times, setTimes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [message, setMessage] = useState("");
  const [otherAvailability, setOtherAvailability] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleTime(slot: string) {
    setTimes((prev) => {
      if (prev.includes(slot)) return prev.filter((t) => t !== slot);
      if (prev.length >= MAX_PREFERRED_TIMES) return prev; // 최대 개수 넘으면 무시
      return [...prev, slot];
    });
  }

  const canSubmit =
    !!program &&
    !!date &&
    times.length >= MIN_PREFERRED_TIMES &&
    !!name.trim() &&
    !!phone.trim() &&
    !!email.trim() &&
    !!ageRange &&
    !!gender &&
    !!referralSource &&
    !!message.trim() &&
    !!otherAvailability.trim() &&
    agreed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setSubmitting(false);
      setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/counselor-inquiry", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          program,
          preferredDate: date,
          preferredTimes: times,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          ageRange,
          gender,
          referralSource,
          message: message.trim(),
          otherAvailability: otherAvailability.trim(),
          agreed,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "신청에 실패했어요.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "신청에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[15px] font-medium text-foreground">상담 예약 신청</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full px-2 py-1 text-slate-500">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {done ? (
            <div className="py-8 text-center">
              <p className="text-[15px] font-medium text-foreground">신청이 접수됐어요.</p>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                예약 신청 시 48시간 내에 연락 드려요. 연락이 없으면 마이페이지의 상담사 연결로 다시 문의해주세요.
              </p>
              <button type="button" onClick={onClose} className="mt-5 h-10 rounded-xl bg-navy px-5 text-[14px] font-medium text-white">
                닫기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-[14px]">
              <div className="rounded-xl bg-navy-soft p-3 text-[12.5px] leading-5 text-slate-600">
                <p className="font-medium text-navy">예약 및 문의</p>
                <p>예약 신청 시 48시간 내에 연락 드리겠습니다.</p>
                <p>연락이 없을 시 문의주시면 빠르게 답변드리겠습니다.</p>
                <p className="mt-2 font-medium text-navy">장소</p>
                <p>화상상담 — 구글 밋(Google Meet)</p>
                <p>센터 — 공덕, 상수 (상수역 3분 거리 / 공덕역 5분 거리)</p>
              </div>

              <div>
                <p className="mb-2 font-medium text-foreground">프로그램</p>
                <div className="flex flex-col gap-2">
                  {PROGRAMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProgram(p.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left ${
                        program === p.id ? "border-navy bg-navy-soft" : "border-line"
                      }`}
                    >
                      <p className="font-medium text-foreground">{p.label}</p>
                      <p className="text-[12.5px] text-slate-500">
                        {p.duration} · {p.price}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-foreground">날짜</p>
                <input
                  type="date"
                  value={date}
                  min={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                />
              </div>

              <div>
                <p className="mb-1 font-medium text-foreground">
                  가능한 시간 ({MIN_PREFERRED_TIMES}~{MAX_PREFERRED_TIMES}개 선택)
                </p>
                <p className="mb-2 text-[12.5px] text-slate-500">
                  아직 실시간 예약 확인이 안 돼서, 가능한 시간을 몇 개 골라주시면 확인 후 다시 연락드려요.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleTime(slot)}
                      className={`rounded-lg border px-2 py-2 text-[13px] ${
                        times.includes(slot) ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <p className="mb-1 text-slate-400">이름*</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <p className="mb-1 text-slate-400">연락처*</p>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <p className="mb-1 text-slate-400">이메일*</p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-background px-3 outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <p className="mb-1 text-slate-400">나이*</p>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-background px-2 outline-none focus:border-navy"
                  >
                    <option value="">선택해주세요</option>
                    {AGE_RANGES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-slate-400">성별*</p>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-background px-2 outline-none focus:border-navy"
                  >
                    <option value="">선택해주세요</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-1 text-slate-400">어떻게 쏠 심리케어 센터를 알고 오셨나요?*</p>
                <select
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-background px-2 outline-none focus:border-navy"
                >
                  <option value="">선택해주세요</option>
                  {REFERRAL_SOURCES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-slate-400">면담 시 문의사항을 적어주세요. 자세히 적을수록 면담에 도움이 됩니다.*</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-line bg-background px-3 py-2 outline-none focus:border-navy"
                />
              </div>

              <div>
                <p className="mb-1 text-slate-400">
                  면담/세션이 가능한 다른 시간대를 적어주세요. (예: 월요일 저녁 9시 이후, 화요일 오전 등)*
                </p>
                <textarea
                  value={otherAvailability}
                  onChange={(e) => setOtherAvailability(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-line bg-background px-3 py-2 outline-none focus:border-navy"
                />
              </div>

              <label className="flex items-start gap-2 text-[12.5px] leading-5 text-slate-500">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                <span>
                  예약 신청을 위해 위 개인정보를 수집하는 것에 동의합니다. 수집한 정보는 접수로부터 1년 또는 서비스 진행 시
                  종료일로부터 3년 후 파기합니다. 본 개인정보는 상담 목적으로만 활용되며, 개인정보 활용 미동의 시 서비스 진행이
                  어렵습니다.
                </span>
              </label>

              {error && <p className="text-[13px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="h-11 rounded-xl bg-navy text-[14px] font-medium text-white disabled:opacity-40"
              >
                {submitting ? "신청하는 중…" : "신청"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
