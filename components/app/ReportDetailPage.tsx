"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { DOMAIN_LABELS } from "@/lib/wellness/domainLabels";
import { groupIntoParagraphs } from "@/lib/text/paragraphs";
import DomainRadarChart from "./DomainRadarChart";

type ReportSection = { title: string; body: string };
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
  report: { sections: ReportSection[] } | null;
};

// "YYYY-MM-DDTHH:mm:ss+00:00" -> "YYYY년 M월 D일 응시" (표시용)
function formatTestDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 응시`;
}

function renderBoldParts(content: string) {
  return content.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
    chunk.startsWith("**") && chunk.endsWith("**") ? (
      <strong key={j} className="font-semibold text-foreground">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <span key={j}>{chunk}</span>
    ),
  );
}

// 결과보고서 본문은 마크다운 스타일(**굵게**, - 목록)로 와서, 기호를 그대로 노출하지 않도록
// 아주 가벼운 렌더링만 한다(별도 마크다운 라이브러리 없이) — MyPageTab.tsx에 있던 것을 그대로
// 옮겨왔다(보고서 본문이 이 페이지로 옮겨왔으므로).
// 2026-09-28 owner 피드백: 문장 구분 없이 줄글이 길게 이어져서 읽기 불편했다 — 목록이 아닌
// 줄은 문장 단위로 3개씩 묶어 문단으로 나누고, 문단 사이에 빈 줄만큼 여백을 준다.
function renderLiteMarkdown(text: string) {
  return text.split("\n").flatMap((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return [<div key={`sp-${i}`} className="h-2" />];
    if (trimmed.startsWith("- ")) {
      return [
        <p key={i} className="pl-3 before:mr-1.5 before:content-['·']">
          {renderBoldParts(trimmed.slice(2))}
        </p>,
      ];
    }
    return groupIntoParagraphs(trimmed, 3).map((paragraph, j) => (
      <p key={`${i}-${j}`} className={j > 0 ? "mt-3" : ""}>
        {renderBoldParts(paragraph)}
      </p>
    ));
  });
}

export default function ReportDetailPage({ resultId }: { resultId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
              캐릭터 이미지 + 오각형 그래프를 같이 보여준다. 캐릭터 이미지는 새로 받을 필요 없이
              이미 저장소에 있는 홈 탭과 같은 파일(public/characters/<유형코드>.png)을 그대로
              재사용한다.
              2026-09-30: 형제 사이트 결과 화면과 같은 순서(이미지 → 기본설명 → 그래프 →
              줄글 설명)로 맞춰달라는 요청 — 원래는 이름/태그라인 텍스트가 이미지보다 먼저
              나오고 있었다. */}
          <div className="relative mx-auto mt-3 aspect-square w-full max-w-[220px]">
            <Image
              src={`/characters/${data.persona.dessertCode}.png`}
              alt={data.persona.name}
              fill
              className="object-contain"
            />
          </div>

          <p className="mt-3 text-[19px] font-medium text-foreground">{data.persona.name}</p>
          <p className="mt-0.5 text-[14px] text-navy">{data.persona.tagline}</p>
          <p className="mt-3 text-[16px] leading-7 text-foreground">{data.persona.blurb}</p>

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

          {data.report ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-[13px] font-medium text-slate-400">결과보고서</p>
              <div className="space-y-5 text-[16px] leading-7 text-slate-600">
                {data.report.sections.map((s, i) => (
                  <div key={i}>
                    <p className="text-[16px] font-medium text-foreground">{s.title}</p>
                    <div className="mt-1.5 space-y-1.5">{renderLiteMarkdown(s.body)}</div>
                  </div>
                ))}
              </div>
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
