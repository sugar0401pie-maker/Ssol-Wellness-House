"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { interpretationPages, splitFirstSentence, type Insight } from "@/lib/interp/insights";

// 쏘웰라가 파악한 내용(2026-10-18, 로드맵 10번) — 진단·성격 라벨이 아니라 "~일 수 있어요" 제안 문장이다.
// 2026-11-24 대표님 요청: 맞아요/아니에요·지우기 버튼 없음(보기만 — 지우고 싶으면 '고객의 의견'·탈퇴로 요청, 서버 PATCH·DELETE는 남겨 둠) · 첫 문장 굵게 ·
//   마이페이지 맨 위에는 "가장 최근 대화 기준" 한 개(LatestInsightCard) → "더 알아보기"로 들어오면 "○○님과의 대화에서 읽은 것들"(InsightsSection).
// 서버의 맞아요/아니에요(confirm/reject) 처리는 그대로 둔다(예전 답은 그대로 반영).

type Payload = { items: Insight[]; latest?: Insight | null; growth?: string[]; name?: string | null };

async function call(method: "GET"): Promise<Payload> {
  const token = await getAccessToken();
  if (!token) throw new Error("login");
  const res = await fetch("/api/mypage/insights", { method, headers: authHeaders(token), cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Payload;
}

function InsightText({ text, size = "text-[14px]" }: { text: string; size?: string }) {
  const [first, rest] = splitFirstSentence(text);
  return (
    <p className={`${size} leading-6 text-foreground`}>
      <strong className="font-bold">{first}</strong>
      {rest && ` ${rest}`}
    </p>
  );
}

// 마이페이지 맨 위 카드 — 가장 최근 대화에서 비친 마음 한 개. 대화에서 비친 게 아직 없으면 그리지 않는다.
// 2026-11-24 대표님: 문장이 "~하는 분들이 있어요"처럼 일반론이라 뜬금없게 느껴질 수 있어, 앞에 "{닉네임}님과 나눈 최근 대화를 보면" 한 줄로 그 사람 이야기임을 먼저 알려 준다.
export function insightLeadIn(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? `${n}님과 나눈 최근 대화를 보면, 이런 마음이 보여요.` : "최근 나눈 대화를 보면, 이런 마음이 보여요.";
}

export function LatestInsightCard({ name }: { name?: string | null }) {
  const [latest, setLatest] = useState<Insight | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    call("GET")
      .then((v) => { if (!cancelled) setLatest(v.latest ?? null); })
      .catch(() => { if (!cancelled) setLatest(null); });
    return () => { cancelled = true; };
  }, []);
  if (!latest) return null;
  return (
    <div className="border-b border-line px-4 py-4">
      <div className="rounded-2xl bg-navy-soft p-4">
        <p className="mb-1.5 text-[12px] text-slate-500">최근 대화에서 쏘웰라가 알게 된 마음</p>
        <p className="mb-1 text-[14px] leading-6 text-slate-600">{insightLeadIn(name)}</p>
        <InsightText text={latest.text} size="text-[15px]" />
        <Link href="/mypage/insights" className="mt-3 inline-block rounded-full bg-navy px-3.5 py-1.5 text-[13px] font-medium text-white">
          더 알아보기
        </Link>
      </div>
    </div>
  );
}

// "○○님과의 대화에서 읽은 것들" 화면(2026-11-24 대표님 요청) — 이야기·테스트로 나누지 않고, 글머리표 문단을 줄글로 이어 한 줄씩 띄운다.
// 한 번에 최대 3문단 · "더 알고 싶어요"로 다음 3문단(끝나면 처음으로) · 앞 한 줄은 화면의 첫 문단에만(lib/interp/insights.ts interpretationPages). 맨 아래 채팅으로 가는 버튼.
export default function InsightsSection() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0); // "더 알고 싶어요"로 넘기는 3문단 묶음

  useEffect(() => {
    let cancelled = false;
    call("GET")
      .then((v) => { if (!cancelled) setData(v); })
      .catch(() => { if (!cancelled) setError("불러오지 못했어요. 잠시 후 다시 확인해주세요."); });
    return () => { cancelled = true; };
  }, []);

  const name = data?.name?.trim() || null;
  const pages = data ? interpretationPages(data.items, data.growth ?? [], name) : [];
  const paragraphs = pages.length ? pages[page % pages.length] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[20px] font-bold leading-7 text-foreground">{name ? `${name}님과의 대화에서 읽은 것들` : "대화에서 읽은 것들"}</h1>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">쏘웰라와의 이야기와 고르신 답(심리테스트·온보딩·점성술)을 모아 정리했어요. 정확하지 않을 수 있어요.</p>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {!data && !error && <p className="text-[13px] text-slate-400">불러오는 중…</p>}
      {data && paragraphs.length === 0 && <p className="text-[13px]">아직 정리된 내용이 없어요. 쏘웰라와 더 이야기를 나누면 여기에 쌓여요.</p>}
      {paragraphs.length > 0 && (
        <ul className="list-disc space-y-6 pl-5 marker:text-navy">
          {paragraphs.map((p, i) => {
            const [first, rest] = p.text ? splitFirstSentence(p.text) : ["", ""];
            return (
              <li key={i} className="text-[14.5px] leading-7 text-foreground">
                {p.lead && `${p.lead} `}
                {p.text && (
                  <>
                    <strong className="font-bold">{first}</strong>
                    {rest && ` ${rest}`}{" "}
                  </>
                )}
                {p.extras.join(" ")}
              </li>
            );
          })}
        </ul>
      )}
      {pages.length > 1 && (
        <div className="text-center">
          <button type="button" onClick={() => setPage((x) => (x + 1) % pages.length)} className="rounded-full border border-navy px-4 py-2 text-[14px] font-medium text-navy active:bg-navy-soft">
            더 알고 싶어요
          </button>
        </div>
      )}
      {data && (
        <div className="rounded-2xl bg-navy-soft p-4 text-center">
          <p className="text-[14.5px] leading-6 text-foreground">쏘웰라 AI와 이야기해주셔서 감사해요! 더 얘기해보시겠어요?</p>
          <Link href="/chat" className="mt-3 inline-block rounded-full bg-navy px-4 py-2 text-[14px] font-medium text-white">
            채팅하러 가기
          </Link>
        </div>
      )}
    </div>
  );
}
