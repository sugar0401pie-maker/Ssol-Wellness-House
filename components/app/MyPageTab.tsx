"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";

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
  email: string | null;
  gender: string | null;
  persona: Persona;
  report: { sections: ReportSection[] } | null;
};

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
              <p>
                아직 웰니스 유형 테스트 결과가 없어요. 쏠 웰니스 하우스 홈페이지에서 심리 테스트를 먼저 진행해주시면, 완료 후
                여기서 결과를 확인할 수 있어요.
              </p>
            )}
          </SectionRow>

          <SectionRow title="내 정보 확인" open={open === "info"} onToggle={() => setOpen(open === "info" ? null : "info")}>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-400">이름</dt>
                <dd>{data.displayName ?? "미설정"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">이메일</dt>
                <dd>{data.email ?? "-"}</dd>
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
            <p>전문 상담사와의 연결은 별도 웹페이지에서 진행돼요. 아래 버튼을 누르면 예약 페이지로 이동해요.</p>
            <a
              href="https://ssolwellness.com"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-xl bg-navy px-4 py-2.5 text-[14px] font-medium text-white"
            >
              상담사 연결 페이지로 이동
            </a>
          </SectionRow>
        </div>
      )}
    </div>
  );
}
