"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";
import { requestEmailChange, verifyEmailChange } from "@/lib/supabase/authClient";
import CounselorBookingModal from "./CounselorBookingModal";

type Persona = {
  label: string;
  tagline: string;
  blurb: string;
  traits: string[];
  domainScores: Record<string, number> | null;
} | null;

type ReportSection = { title: string; body: string };
type MyPageData = {
  displayName: string | null;
  nickname: string | null;
  birthDate: string | null;
  email: string | null;
  gender: string | null;
  persona: Persona;
  report: { sections: ReportSection[] } | null;
};

// "YYYY-MM-DD" -> "YYYY년 M월 D일" (표시용)
function formatBirthDate(birthDate: string | null): string {
  if (!birthDate) return "미설정";
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return birthDate;
  return `${y}년 ${m}월 ${d}일`;
}

// 결과보고서 본문은 AI가 마크다운 스타일(**굵게**, - 목록)로 써서, 기호를 그대로 노출하지
// 않도록 아주 가벼운 렌더링만 한다(별도 마크다운 라이브러리 없이) — 채팅의 "마크다운 금지"
// 규칙과 달리, 이 화면은 결제한 리포트를 보여주는 문서형 화면이라 최소한의 서식은 살린다.
function renderLiteMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;
    const isBullet = trimmed.startsWith("- ");
    const content = isBullet ? trimmed.slice(2) : trimmed;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
      chunk.startsWith("**") && chunk.endsWith("**") ? (
        <strong key={j} className="font-semibold text-foreground">
          {chunk.slice(2, -2)}
        </strong>
      ) : (
        <span key={j}>{chunk}</span>
      ),
    );
    return (
      <p key={i} className={isBullet ? "pl-3 before:mr-1.5 before:content-['·']" : ""}>
        {parts}
      </p>
    );
  });
}

function SectionRow({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
        <span className="text-[15px] font-medium text-foreground">{title}</span>
        <span className="text-[13px] text-slate-400">{open ? "접기" : "보기"}</span>
      </button>
      {open && <div className="px-4 pb-4 text-[14px] leading-6 text-slate-600">{children}</div>}
    </div>
  );
}

export default function MyPageTab() {
  const [data, setData] = useState<MyPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<"type" | "info" | "counselor" | null>(null);

  // 내 정보 확인 — 이름(실명) 수정
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // 내 정보 확인 — 닉네임 수정 (2026-09-25: 실명과 별개로 화면 표시용 별칭)
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);

  // 내 정보 확인 — 생년월일 수정
  const [editingBirthDate, setEditingBirthDate] = useState(false);
  const [birthDateInput, setBirthDateInput] = useState("");
  const [birthDateSaving, setBirthDateSaving] = useState(false);

  // 내 정보 확인 — 이메일 변경 (반드시 새 이메일로 인증번호를 받아 확인해야 바뀐다)
  const [emailStep, setEmailStep] = useState<"idle" | "entering" | "verifying">("idle");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailCodeInput, setEmailCodeInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // 상담사 연결 — 2026-09-25: 간단한 문의 폼 대신 실제 예약 페이지와 같은 신청 팝업으로 교체.
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
        return;
      }
      try {
        const res = await fetch("/api/mypage", { headers: authHeaders(token) });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as MyPageData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || nameSaving) return;
    setNameSaving(true);
    const token = await getAccessToken();
    if (!token) {
      setNameSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
      setEditingName(false);
    } catch {
      // 실패해도 편집 상태를 유지해서 다시 시도할 수 있게 한다
    } finally {
      setNameSaving(false);
    }
  }

  async function saveNickname() {
    if (nicknameSaving) return;
    const trimmed = nicknameInput.trim();
    setNicknameSaving(true);
    const token = await getAccessToken();
    if (!token) {
      setNicknameSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ nickname: trimmed }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, nickname: trimmed || null } : prev));
      setEditingNickname(false);
    } catch {
      // 실패해도 편집 상태를 유지해서 다시 시도할 수 있게 한다
    } finally {
      setNicknameSaving(false);
    }
  }

  async function saveBirthDate() {
    if (birthDateSaving || !birthDateInput) return;
    setBirthDateSaving(true);
    const token = await getAccessToken();
    if (!token) {
      setBirthDateSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ birthDate: birthDateInput }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, birthDate: birthDateInput } : prev));
      setEditingBirthDate(false);
    } catch {
      // 실패해도 편집 상태를 유지해서 다시 시도할 수 있게 한다
    } finally {
      setBirthDateSaving(false);
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
    setData((prev) => (prev ? { ...prev, email: trimmed } : prev));
    setEmailStep("idle");
    setNewEmailInput("");
    setEmailCodeInput("");
  }


  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">마이페이지</p>
      </header>

      {error && <p className="px-4 pt-4 text-[13px] text-red-600">{error}</p>}

      {data && (
        <div className="flex-1">
          <SectionRow title="내 유형 열람하기" open={open === "type"} onToggle={() => setOpen(open === "type" ? null : "type")}>
            {data.persona ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[16px] font-medium text-foreground">{data.persona.label}</p>
                  <p className="mt-0.5 text-[13px] text-navy">{data.persona.tagline}</p>
                  <p className="mt-2 leading-6">{data.persona.blurb}</p>
                  {data.persona.traits.length > 0 && (
                    <ul className="mt-2 list-inside list-disc space-y-0.5">
                      {data.persona.traits.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {data.persona.domainScores && (
                    <p className="mt-3 text-[13px] text-slate-500">
                      {Object.entries(data.persona.domainScores)
                        .filter(([k]) => k in DOMAIN_LABELS)
                        .map(([k, v]) => `${DOMAIN_LABELS[k]} ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                {data.report && (
                  <div className="border-t border-line pt-4">
                    <p className="mb-2 text-[13px] font-medium text-slate-400">결과보고서</p>
                    <div className="space-y-5">
                      {data.report.sections.map((s, i) => (
                        <div key={i}>
                          <p className="text-[14px] font-medium text-foreground">{s.title}</p>
                          <div className="mt-1 space-y-1.5">{renderLiteMarkdown(s.body)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p>
                  아직 웰니스 유형 테스트 결과가 없어요. 심리 테스트를 먼저 진행해주시면, 완료 후 여기서 결과를 확인할 수
                  있어요.
                </p>
                <a
                  href="https://quiz.ssolwellnesshouse.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-xl bg-navy px-4 py-2.5 text-[14px] font-medium text-white"
                >
                  지금 테스트하러 가기
                </a>
              </div>
            )}
          </SectionRow>

          <SectionRow title="내 정보 확인" open={open === "info"} onToggle={() => setOpen(open === "info" ? null : "info")}>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">이름(실명)</dt>
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      autoFocus
                      className="h-8 w-28 rounded-lg border border-line px-2 text-[13px] outline-none focus:border-navy"
                    />
                    <button type="button" onClick={() => void saveName()} disabled={nameSaving} className="text-[12px] text-navy">
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingName(false)} className="text-[12px] text-slate-400">
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(data.displayName ?? "");
                      setEditingName(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <dd className="inline">{data.displayName ?? "미설정"}</dd>
                    <span className="text-[11px] text-navy underline">변경</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-slate-400">닉네임</dt>
                {editingNickname ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="비우면 이름이 표시돼요"
                      autoFocus
                      className="h-8 w-32 rounded-lg border border-line px-2 text-[13px] outline-none focus:border-navy"
                    />
                    <button
                      type="button"
                      onClick={() => void saveNickname()}
                      disabled={nicknameSaving}
                      className="text-[12px] text-navy"
                    >
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingNickname(false)} className="text-[12px] text-slate-400">
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNicknameInput(data.nickname ?? "");
                      setEditingNickname(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <dd className="inline">{data.nickname ?? "미설정"}</dd>
                    <span className="text-[11px] text-navy underline">변경</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-slate-400">생년월일</dt>
                {editingBirthDate ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={birthDateInput}
                      onChange={(e) => setBirthDateInput(e.target.value)}
                      autoFocus
                      className="h-8 rounded-lg border border-line px-2 text-[13px] outline-none focus:border-navy"
                    />
                    <button
                      type="button"
                      onClick={() => void saveBirthDate()}
                      disabled={birthDateSaving || !birthDateInput}
                      className="text-[12px] text-navy"
                    >
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingBirthDate(false)} className="text-[12px] text-slate-400">
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBirthDateInput(data.birthDate ?? "");
                      setEditingBirthDate(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <dd className="inline">{formatBirthDate(data.birthDate)}</dd>
                    <span className="text-[11px] text-navy underline">변경</span>
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">이메일</dt>
                  {emailStep === "idle" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmailInput("");
                        setEmailError(null);
                        setEmailStep("entering");
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <dd className="inline">{data.email ?? "-"}</dd>
                      <span className="text-[11px] text-navy underline">변경</span>
                    </button>
                  ) : (
                    <dd className="text-slate-400">{data.email ?? "-"}</dd>
                  )}
                </div>

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
                      autoFocus
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

              {data.gender && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">성별</dt>
                  <dd>{data.gender === "female" ? "여성" : data.gender === "male" ? "남성" : data.gender}</dd>
                </div>
              )}
            </dl>
          </SectionRow>

          <SectionRow
            title="상담사 연결"
            open={open === "counselor"}
            onToggle={() => setOpen(open === "counselor" ? null : "counselor")}
          >
            <p>전문 상담사와의 면담·세션을 신청할 수 있어요. 프로그램, 날짜, 가능한 시간을 골라 신청서를 작성해주세요.</p>
            <button
              type="button"
              onClick={() => setShowBooking(true)}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              상담 예약 신청하기
            </button>
          </SectionRow>
        </div>
      )}

      {showBooking && <CounselorBookingModal onClose={() => setShowBooking(false)} />}
    </div>
  );
}
