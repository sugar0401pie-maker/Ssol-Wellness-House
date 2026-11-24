"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { groupInsights, splitFirstSentence, type Insight } from "@/lib/interp/insights";

// 쏘웰라가 파악한 내용(2026-10-18, 로드맵 10번) — 진단·성격 라벨이 아니라 "~일 수 있어요" 제안 문장이다.
// 2026-11-24 대표님 요청: 맞아요/아니에요 버튼 없음(지우기는 남김) · 첫 문장 굵게 ·
//   마이페이지 맨 위에는 "가장 최근 대화 기준" 한 개(LatestInsightCard) → "더 알아보기"로 들어오면 "당신에 대한 해석입니다"와 쌓인 내용을 묶어서(InsightsPage).
// 서버의 맞아요/아니에요(confirm/reject) 처리는 그대로 둔다(예전 답은 그대로 반영).

type Payload = { items: Insight[]; latest?: Insight | null; growth?: string[] };

async function call(method: "GET" | "PATCH" | "DELETE", body?: { rootId: string; action: "remove" }): Promise<Payload> {
  const token = await getAccessToken();
  if (!token) throw new Error("login");
  const res = await fetch("/api/mypage/insights", { method, headers: authHeaders(token), cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}) });
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
  return n ? `${n}님과 나눈 최근 대화를 보면, 이런 마음이 있을 수 있어요.` : "최근 나눈 대화를 보면, 이런 마음이 있을 수 있어요.";
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

// "당신에 대한 해석" 화면 — 쌓인 내용을 묶음별로(맞다고 하신 마음 → 이야기 속에서 자주 비친 마음 → 고르신 답에서 보인 마음) + 요즘의 변화.
export default function InsightsSection() {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [growth, setGrowth] = useState<string[]>([]); // 요즘의 변화 한 줄(성장 방향·동기 위치 — 늘었을 때·처음일 때만 있고 줄었다는 말은 없음)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    call("GET")
      .then((v) => { if (!cancelled) { setItems(v.items); setGrowth(v.growth ?? []); } })
      .catch(() => { if (!cancelled) setError("불러오지 못했어요. 잠시 후 다시 확인해주세요."); });
    return () => { cancelled = true; };
  }, []);

  async function remove(rootId: string) {
    setBusy(rootId);
    setError(null);
    try { setItems((await call("PATCH", { rootId, action: "remove" })).items); }
    catch { setError("지우지 못했어요. 잠시 후 다시 시도해주세요."); }
    finally { setBusy(null); }
  }

  async function clearAll() {
    setBusy("all");
    setError(null);
    try { setItems((await call("DELETE")).items); setGrowth([]); setConfirmAll(false); }
    catch { setError("지우지 못했어요. 잠시 후 다시 시도해주세요."); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-[20px] font-bold leading-7 text-foreground">당신에 대한 해석입니다</h1>
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
          쏘웰라와의 이야기와 고르신 답(심리테스트·온보딩·점성술)을 모아 정리한 마음이에요. 정확하지 않을 수 있어요. 지우면 더는 쓰지 않아요.
        </p>
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {items === null && !error && <p className="text-[13px] text-slate-400">불러오는 중…</p>}
      {growth.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-[12px] text-slate-400">요즘의 변화</p>
          {growth.map((g) => <p key={g} className="text-[14px] leading-6 text-foreground">{g}</p>)}
        </div>
      )}
      {items?.length === 0 && <p className="text-[13px]">아직 정리된 내용이 없어요. 쏘웰라와 더 이야기를 나누면 여기에 쌓여요.</p>}
      {items && groupInsights(items).map((g) => (
        <section key={g.key}>
          <p className="mb-2 text-[15px] font-bold text-foreground">{g.title}</p>
          <div className="space-y-2.5">
            {g.items.map((it) => (
              <div key={it.rootId} className="rounded-xl border border-line p-3">
                <InsightText text={it.text} />
                {it.strength && <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{it.strength}</p>}
                {it.directionLine && <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{it.directionLine}</p>}
                <button type="button" disabled={busy !== null} onClick={() => remove(it.rootId)} className="mt-2.5 rounded-full border border-line px-3 py-1 text-[13px] text-slate-500 disabled:opacity-50">
                  지우기
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!!items?.length && (
        <div className="pt-1">
          {!confirmAll ? (
            <button type="button" onClick={() => setConfirmAll(true)} className="text-[13px] text-slate-400 underline">전부 지우기</button>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-[13px]">
              <p className="mb-2 leading-5">쏘웰라가 파악한 내용을 모두 지울까요? 대화 기록은 그대로 남아요.</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy !== null} onClick={clearAll} className="rounded-full border border-line px-3 py-1 text-foreground disabled:opacity-50">모두 지우기</button>
                <button type="button" onClick={() => setConfirmAll(false)} className="rounded-full px-3 py-1 text-slate-500">취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
