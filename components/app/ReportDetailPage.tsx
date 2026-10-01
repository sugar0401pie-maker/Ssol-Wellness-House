"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";
import type { ReportSectionData } from "@/lib/mypage/assembledReport";
import { leadInIndexFor, splitBoldParagraph } from "@/lib/mypage/reportParagraph";
import { splitSentences } from "@/lib/text/paragraphs";
import { pickRandomVariant } from "@/lib/characters/variants";
import DomainRadarChart from "./DomainRadarChart";

type ReportDetail = {
  createdAt: string;
  persona: {
    dessertCode: string;
    name: string;
    tagline: string;
    blurb: string;
    traits: string[];
    domainScores: Record<string, number> | null;
  };
  report: { sections: ReportSectionData[] } | null;
};

// "YYYY-MM-DDTHH:mm:ss+00:00" -> "YYYY년 M월 D일 응시" (표시용)
function formatTestDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 응시`;
}

// 2026-09-30 owner 피드백: "너무 줄글이라서" — 형제 사이트(quiz.ssolwellnesshouse.com)의
// 결제 후 화면(ReportSectionCard.tsx)과 같은 번호 원 배지 + 제목 카드 모양으로 바꿨다.
// 이미 마이페이지에서 직접 골라 들어온 화면이라 아코디언 토글 없이 전부 펼쳐서 보여준다.
// 2026-09-30 추가 피드백: "줄글이 길어서 읽기 불편" — 1번(당신의 웰니스 프로파일)만 기본으로
// 펼쳐두고 2~8번은 기본 접힘, 제목 아래 첫 문장만 미리보기로 보여준다.
function ReportSectionCard({ num, section }: { num: number; section: ReportSectionData }) {
  const [open, setOpen] = useState(num === 1);
  const leadInIdx = leadInIndexFor(section.key, section.paragraphs);
  const isLast8 = section.key === "section8";
  const preview = section.paragraphs.length > 0 ? splitSentences(section.paragraphs[0])[0] : "";

  return (
    <div className="mb-3 rounded-2xl border border-line bg-white p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-foreground">{section.title}</p>
          {!open && preview && <p className="mt-0.5 truncate text-[13px] text-slate-400">{preview}</p>}
        </div>
        <span className="flex-shrink-0 text-[12px] text-slate-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {section.paragraphs.map((p, i) => {
            const isHighlight = isLast8 && i === section.paragraphs.length - 1;
            const { boldText, restText } = splitBoldParagraph(p, i === leadInIdx);
            if (isHighlight) {
              return (
                <div key={i} className="rounded-xl border-[1.5px] border-navy px-3.5 py-3">
                  <p className="text-[14px] font-bold leading-7 text-foreground">{p}</p>
                </div>
              );
            }
            return (
              <p key={i} className="text-[14px] leading-7 text-slate-600">
                {boldText ? (
                  <>
                    <strong className="font-semibold text-foreground">{boldText}</strong>
                    {restText}
                  </>
                ) : (
                  p
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportDetailPage({ resultId }: { resultId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 2026-10-01: 페이지가 열릴 때 한 번만 뽑는다 — 홈 탭과는 별도로 독립적으로 뽑히므로
  // 같은 유형이어도 홈과 심층보고서의 캐릭터 그림이 서로 다를 수 있다(owner가 원한 동작).
  const [variant] = useState(pickRandomVariant);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
        return;
      }
      try {
        const res = await fetch(`/api/mypage/reports/${resultId}`, { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as ReportDetail;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("결과를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white px-5 py-8">
      <button type="button" onClick={() => router.push("/mypage")} className="mb-4 self-start text-[13px] text-slate-500">
        ← 마이페이지로
      </button>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {data && (
        <>
          <p className="text-[13px] text-slate-400">{formatTestDate(data.createdAt)}</p>

          {/* 2026-09-28 owner 요청: 형제 사이트(quiz.ssolwellnesshouse.com) 결과 화면처럼
              캐릭터 이미지 + 오각형 그래프를 같이 보여준다.
              2026-09-30: 형제 사이트 결과 화면과 같은 순서(이미지 → 기본설명 → 그래프 →
              줄글 설명)로 맞춰달라는 요청 — 원래는 이름/태그라인 텍스트가 이미지보다 먼저
              나오고 있었다.
              2026-10-01 owner 요청: 유형별 5가지 변형 이미지 중 하나를 랜덤으로 보여주고
              (이 화면은 항상 결과가 있는 상태에서만 보이므로 홈 탭과 달리 분기 없음), 화면
              크기도 키운다(220px -> 280px). */}
          <div className="relative mx-auto mt-3 aspect-square w-full max-w-[280px]">
            <Image
              src={`/characters/${data.persona.dessertCode}/${variant}.png`}
              alt={data.persona.name}
              fill
              className="object-contain"
            />
          </div>

          <p className="mt-3 text-[19px] font-medium text-foreground">{data.persona.name}</p>
          <p className="mt-0.5 text-[14px] text-navy">{data.persona.tagline}</p>

          {/* 2026-09-30 owner 요청: 형제 사이트 순서(캐릭터설명 → 특징 → 그래프 → 줄글)에 맞춰
              traits(특징 뱃지)를 태그라인 바로 다음, blurb(줄글)를 그래프 다음으로 옮겼다. */}
          {data.persona.traits.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-0.5 text-[16px] leading-7 text-slate-600">
              {data.persona.traits.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}

          {data.persona.domainScores && (
            <div className="mt-5">
              <DomainRadarChart scores={data.persona.domainScores} />
              <p className="mt-2 text-center text-[13px] text-slate-500">
                {Object.entries(data.persona.domainScores)
                  .filter(([k]) => k in DOMAIN_LABELS)
                  .map(([k, v]) => `${DOMAIN_LABELS[k]} ${v.toFixed(2)}`)
                  .join(" · ")}
              </p>
            </div>
          )}

          <p className="mt-5 text-[16px] leading-7 text-foreground">{data.persona.blurb}</p>

          {data.report ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-[13px] font-medium text-slate-400">결과보고서</p>
              {data.report.sections.map((section, i) => (
                <ReportSectionCard key={section.key} num={i + 1} section={section} />
              ))}
            </div>
          ) : (
            <p className="mt-6 border-t border-line pt-5 text-[13px] leading-5 text-slate-400">
              이 응시 기록에는 아직 심층보고서가 없어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}
