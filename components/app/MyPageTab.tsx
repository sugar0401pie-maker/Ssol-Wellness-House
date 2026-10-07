"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import CustomerFeedbackModal from "./CustomerFeedbackModal";
import OnboardingFlow from "./OnboardingFlow";
import PasswordConfirmModal from "./PasswordConfirmModal";
import MyInfoEditModal, { type MyInfo } from "./MyInfoEditModal";

type MyPageData = MyInfo & { gender: string | null; hasPassword: boolean };

// 2026-09-27: "지금은 보고서가 1개인데 나중에 여러 개를 열람할 수도 있으니" — 응시 기록을
// 목록으로 보여주고, 각 항목의 "열기"를 누르면 /report/[resultId]에서 전체 심층보고서를 본다.
type ReportListItem = {
  id: string;
  createdAt: string;
  dessertCode: string;
  dessertName: string;
  hasReport: boolean;
  isPrimary: boolean;
};

// 2026-10-07: 쏠 타로 하우스(tarot.ssolwellnesshouse.com, 같은 계정) 결과 — /api/mypage/tarot.
type TarotReading = {
  id: string;
  createdAt: string;
  cards: { position: string; positionName: string; name: string; character: string; reversed: boolean }[];
  topic: { domain: string; emotions: string[]; need: string } | null;
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

// ISO 타임스탬프 -> "YYYY년 M월 D일" (표시용)
function formatDateTimeKR(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 2026-09-28 owner 요청: 마이페이지에서 이용권 상태를 볼 수 있게 한다.
type BillingStatus = {
  allowed: boolean;
  reason: "entitlement" | "trial" | "expired";
  trialEndsAt: string;
  entitlementExpiresAt: string | null;
  // 2026-10-01: 심층보고서 보유 여부로 7일/3일 갈리는 실제 무료체험 일수.
  trialDays: number;
};

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
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tarot, setTarot] = useState<{ readings: TarotReading[]; tarotUrl: string } | null>(null);
  const [open, setOpen] = useState<"type" | "tarot" | "info" | "billing" | "onboarding" | "counselor" | "feedback" | null>(null);
  const [editingOnboarding, setEditingOnboarding] = useState(false);

  // 내 정보 확인 — 2026-09-25: 개별 필드 편집 대신, 비밀번호 재확인 후 통합 수정 화면을 연다.
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showInfoEdit, setShowInfoEdit] = useState(false);

  // 고객의 의견 — 2026-10-01 신설: 건의/제안을 받아 접수만 해둔다(owner가 수동 확인).
  const [showFeedback, setShowFeedback] = useState(false);

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
        const [infoRes, reportsRes, billingRes] = await Promise.all([
          fetch("/api/mypage", { headers: authHeaders(token), cache: "no-store" }),
          fetch("/api/mypage/reports", { headers: authHeaders(token), cache: "no-store" }),
          fetch("/api/billing/status", { headers: authHeaders(token), cache: "no-store" }),
        ]);
        if (!infoRes.ok || !reportsRes.ok || !billingRes.ok) throw new Error();
        const json = (await infoRes.json()) as MyPageData;
        const reportsJson = (await reportsRes.json()) as { reports: ReportListItem[] };
        const billingJson = (await billingRes.json()) as BillingStatus;
        // 타로 결과는 부가 정보라 실패해도 마이페이지 전체를 막지 않는다.
        fetch("/api/mypage/tarot", { headers: authHeaders(token), cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((t) => !cancelled && t && setTarot(t))
          .catch(() => {});
        if (!cancelled) {
          setData(json);
          setReports(reportsJson.reports);
          setBilling(billingJson);
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

  // 2026-09-28: "대표 유형으로 선택" — 홈 화면/채팅이 이 응시 기록을 쓰도록 고정한다.
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  async function selectPrimary(resultId: string) {
    if (settingPrimaryId) return;
    setSettingPrimaryId(resultId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error();
      const res = await fetch("/api/mypage/primary-type", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ resultId }),
      });
      if (!res.ok) throw new Error();
      setReports((prev) => prev?.map((r) => ({ ...r, isPrimary: r.id === resultId })) ?? prev);
    } catch {
      setError("대표 유형 지정에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSettingPrimaryId(null);
    }
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.isPrimary ? (
                        <span className="rounded-full bg-navy-soft px-3 py-1.5 text-[12px] font-medium text-navy">대표 유형</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectPrimary(r.id)}
                          disabled={settingPrimaryId === r.id}
                          className="rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-slate-500 active:bg-background disabled:opacity-60"
                        >
                          대표 유형으로 선택
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => router.push(`/report/${r.id}`)}
                        className="rounded-full border border-navy px-3 py-1.5 text-[13px] font-medium text-navy active:bg-navy-soft"
                      >
                        열기
                      </button>
                    </div>
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

          <SectionRow title="타로 결과" open={open === "tarot"} onToggle={() => setOpen(open === "tarot" ? null : "tarot")}>
            {tarot && tarot.readings.length > 0 ? (
              <div className="divide-y divide-line rounded-xl border border-line">
                {tarot.readings.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-slate-400">{formatShortDate(t.createdAt)}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {t.cards.map((c) => (
                          <li key={c.position} className="text-[13px] text-foreground">
                            <span className="text-slate-400">{c.positionName}</span> · {c.name}
                            {c.reversed && <span className="ml-1 text-[11px] text-navy">역방향</span>}
                          </li>
                        ))}
                      </ul>
                      {t.topic && <p className="mt-1 text-[12px] text-slate-500">{t.topic.domain} 고민</p>}
                    </div>
                    <a
                      href={`${tarot.tarotUrl}/result/${t.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-navy px-3 py-1.5 text-[13px] font-medium text-navy active:bg-navy-soft"
                    >
                      열기
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p>아직 이 계정에 저장된 타로 결과가 없어요. 쏠 타로 하우스에서 카드를 뽑고 “결과 저장하기”를 누르면 여기에 모여요.</p>
                <a
                  href={tarot?.tarotUrl ?? "https://tarot.ssolwellnesshouse.com"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-xl bg-navy px-4 py-2.5 text-[14px] font-medium text-white"
                >
                  타로 보러 가기
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
              onClick={() => {
                // 2026-09-28 버그 수정: 카카오/네이버로 가입한 사용자는 비밀번호 자체가 없어서
                // 재확인 단계를 통과할 방법이 없었다(항상 실패) — 그런 계정은 비밀번호 확인
                // 없이 바로 수정 화면으로 보낸다. 세션이 이미 그 provider의 최근 로그인으로
                // 확인된 상태라, 이메일/비밀번호 계정과 동등한 수준의 확인이라고 본다.
                if (data && !data.hasPassword) setShowInfoEdit(true);
                else setShowPasswordConfirm(true);
              }}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              정보 수정
            </button>
          </SectionRow>

          <SectionRow title="이용권 정보" open={open === "billing"} onToggle={() => setOpen(open === "billing" ? null : "billing")}>
            {billing && (
              <>
                {billing.reason === "entitlement" ? (
                  <p>
                    이용권 이용 중이에요.
                    {billing.entitlementExpiresAt ? ` (만료일: ${formatDateTimeKR(billing.entitlementExpiresAt)})` : " (만료일 없음)"}
                  </p>
                ) : (
                  <p>
                    채팅 무료체험 만료일: {formatDateTimeKR(billing.trialEndsAt)} (가입일로부터 +{billing.trialDays}일,
                    가입일 포함 — 심층보고서가 있으면 7일, 없으면 3일이에요)
                  </p>
                )}
                <p className="mt-1.5 text-slate-500">만료 이후에도 기존 대화내역과 심층 보고서는 볼 수 있어요.</p>
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
                >
                  웰니스 채팅 구독하기
                </button>
              </>
            )}
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
            title="웰니스 상담 신청하기"
            open={open === "counselor"}
            onToggle={() => setOpen(open === "counselor" ? null : "counselor")}
          >
            <p>전문 상담사와의 면담·세션을 신청할 수 있어요. 프로그램, 날짜, 가능한 시간을 골라 신청서를 작성해주세요.</p>
            <button
              type="button"
              onClick={() => router.push("/session-reserve")}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              상담 예약 신청하기
            </button>
          </SectionRow>

          <SectionRow
            title="고객의 의견"
            open={open === "feedback"}
            onToggle={() => setOpen(open === "feedback" ? null : "feedback")}
          >
            <p>쏘웰라 이용에 불편이 있거나 제안사항이 있으실 경우 편하게 알려주세요.</p>
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="mt-3 h-10 rounded-xl bg-navy px-4 text-[14px] font-medium text-white"
            >
              건의하기
            </button>
          </SectionRow>
        </div>
      )}

      {showFeedback && <CustomerFeedbackModal onClose={() => setShowFeedback(false)} />}

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
