"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import CounselorBookingModal from "./CounselorBookingModal";
import OnboardingFlow from "./OnboardingFlow";
import PasswordConfirmModal from "./PasswordConfirmModal";
import MyInfoEditModal, { type MyInfo } from "./MyInfoEditModal";

type MyPageData = MyInfo & { gender: string | null };

// 2026-09-27: "지금은 보고서가 1개인데 나중에 여러 개를 열람할 수도 있으니" — 응시 기록을
// 목록으로 보여주고, 각 항목의 "열기"를 누르면 /report/[resultId]에서 전체 심층보고서를 본다.
type ReportListItem = {
  id: string;
  createdAt: string;
  dessertCode: string;
  dessertName: string;
  hasReport: boolean;
};

// "YYYY-MM-DDTHH:mm:ss+00:00" -> "YYYY.MM.DD" (표시용)
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" -> "YYYY년 M월 D일" (표시용)
function formatBirthDate(birthDate: string | null): string {
  if (!birthDate) return "미설정";
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return birthDate;
  return `${y}년 ${m}월 ${d}일`;
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
  const router = useRouter();
  const [data, setData] = useState<MyPageData | null>(null);
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<"type" | "info" | "onboarding" | "counselor" | null>(null);
  const [editingOnboarding, setEditingOnboarding] = useState(false);

  // 내 정보 확인 — 2026-09-25: 개별 필드 편집 대신, 비밀번호 재확인 후 통합 수정 화면을 연다.
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showInfoEdit, setShowInfoEdit] = useState(false);

  // 상담사 연결 — 2026-09-24: 간단한 문의 폼 대신 실제 예약 페이지와 같은 신청 팝업으로 교체.
  const [showBooking, setShowBooking] = useState(false);

  // 2026-09-26: 다른 창(심리테스트 사이트)에서 테스트를 마치고 이 앱으로 돌아오면 자동으로 다시
  // 불러온다 — 탭은 계속 마운트돼 있어서 마운트 시 1회 조회만으로는 새 결과가 반영되지 않았다.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
        return;
      }
      try {
        const [infoRes, reportsRes] = await Promise.all([
          fetch("/api/mypage", { headers: authHeaders(token), cache: "no-store" }),
          fetch("/api/mypage/reports", { headers: authHeaders(token), cache: "no-store" }),
        ]);
        if (!infoRes.ok || !reportsRes.ok) throw new Error();
        const json = (await infoRes.json()) as MyPageData;
        const reportsJson = (await reportsRes.json()) as { reports: ReportListItem[] };
        if (!cancelled) {
          setData(json);
          setReports(reportsJson.reports);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }
    void load();
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  function applyInfoUpdate(next: Partial<MyInfo>) {
    setData((prev) => (prev ? { ...prev, ...next } : prev));
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
            {reports && reports.length > 0 ? (
              <div className="divide-y divide-line rounded-xl border border-line">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3.5 py-3">
                    <div>
                      <p className="text-[12px] text-slate-400">{formatShortDate(r.createdAt)}</p>
                      <p className="mt-0.5 text-[14px] font-medium text-foreground">
                        {r.dessertName} 유형{r.hasReport && <span className="ml-1.5 text-[11px] font-normal text-navy">심층보고서</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/report/${r.id}`)}
                      className="shrink-0 rounded-full border border-navy px-3 py-1.5 text-[13px] font-medium text-navy active:bg-navy-soft"
                    >
                      열기
                    </button>
                  </div>
                ))}
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
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-400">이름(실명)</dt>
                <dd>{data.displayName ?? "미설정"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">닉네임</dt>
                <dd>{data.nickname ?? "미설정"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">생년월일</dt>
                <dd>{formatBirthDate(data.birthDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">이메일</dt>
                <dd>{data.email ?? "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">휴대전화번호</dt>
                <dd>{data.phone ?? "미설정"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-slate-400">주소</dt>
                <dd className="text-right">{data.address ?? "미설정"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">마케팅 정보 활용 동의</dt>
                <dd>{data.marketingConsent ? "동의함" : "동의 안 함"}</dd>
              </div>
              {data.gender && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">성별</dt>
                  <dd>{data.gender === "female" ? "여성" : data.gender === "male" ? "남성" : data.gender}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              onClick={() => setShowPasswordConfirm(true)}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              정보 수정
            </button>
          </SectionRow>

          <SectionRow
            title="온보딩 답변 수정"
            open={open === "onboarding"}
            onToggle={() => setOpen(open === "onboarding" ? null : "onboarding")}
          >
            <p>가입 직후 답했던 생활·취향 질문을 다시 확인하거나 바꿀 수 있어요. 바뀐 내용은 다음 날 추천부터 반영돼요.</p>
            <button
              type="button"
              onClick={() => setEditingOnboarding(true)}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              답변 수정하기
            </button>
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

      {editingOnboarding && (
        <OnboardingFlow
          mode="edit"
          nickname={data?.nickname ?? data?.displayName ?? null}
          onDone={() => setEditingOnboarding(false)}
          onClose={() => setEditingOnboarding(false)}
        />
      )}

      {showPasswordConfirm && data?.email && (
        <PasswordConfirmModal
          email={data.email}
          onConfirmed={() => {
            setShowPasswordConfirm(false);
            setShowInfoEdit(true);
          }}
          onCancel={() => setShowPasswordConfirm(false)}
        />
      )}

      {showInfoEdit && data && (
        <MyInfoEditModal info={data} onClose={() => setShowInfoEdit(false)} onSaved={applyInfoUpdate} />
      )}
    </div>
  );
}
