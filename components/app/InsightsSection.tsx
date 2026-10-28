"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import type { Insight } from "@/lib/interp/insights";

// 마이페이지 "쏘웰라가 파악한 내용"(2026-10-18, 로드맵 10번). 대화에서 쏘웰라가 짐작해 본 마음을 보여 주고,
// 사용자가 맞아요/아니에요/지우기로 직접 바로잡는다. 진단·성격 라벨이 아니라 "~일 수 있어요" 제안 문장이다.
export default function InsightsSection() {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [growth, setGrowth] = useState<string[]>([]); // 요즘의 변화 한 줄(성장 방향·동기 위치 — 늘었을 때·처음일 때만 있고 줄었다는 말은 없음)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  async function call(method: "GET" | "PATCH" | "DELETE", body?: { rootId: string; action: "confirm" | "reject" | "remove" }) {
    const token = await getAccessToken();
    if (!token) throw new Error("login");
    const res = await fetch("/api/mypage/insights", { method, headers: authHeaders(token), cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as { items: Insight[]; growth?: string[] };
  }

  useEffect(() => {
    let cancelled = false;
    call("GET")
      .then((v) => { if (!cancelled) { setItems(v.items); setGrowth(v.growth ?? []); } })
      .catch(() => { if (!cancelled) setError("불러오지 못했어요. 잠시 후 다시 확인해주세요."); });
    return () => { cancelled = true; };
  }, []);

  async function act(rootId: string, action: "confirm" | "reject" | "remove") {
    setBusy(rootId);
    setError(null);
    try { setItems((await call("PATCH", { rootId, action })).items); }
    catch { setError("저장하지 못했어요. 잠시 후 다시 시도해주세요."); }
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
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-slate-500">
        쏘웰라와의 이야기와 고르신 답(심리테스트·온보딩·점성술)으로 짐작해 본 마음이에요. 정확하지 않을 수 있어서, 아니라면 알려주세요. 지우면 더는 쓰지 않아요.
      </p>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      {items === null && !error && <p className="text-[13px] text-slate-400">불러오는 중…</p>}
      {growth.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-[12px] text-slate-400">요즘의 변화</p>
          {growth.map((g) => <p key={g} className="text-[14px] leading-6 text-foreground">{g}</p>)}
        </div>
      )}
      {items?.length === 0 && <p className="text-[13px]">아직 정리된 내용이 없어요. 쏘웰라와 더 이야기를 나누면 여기에 쌓여요.</p>}
      {items?.map((it) => (
        <div key={it.rootId} className="rounded-xl border border-line p-3">
          <p className="mb-1 text-[12px] text-slate-400">{it.status === "confirmed" ? "맞다고 하신 마음" : it.from === "chat" ? "이야기에서 짐작한 마음" : "고르신 답(테스트·온보딩·점성술)에서 짐작한 마음"}</p>
          <p className="text-[14px] leading-6 text-foreground">{it.text}</p>
          {it.strength && <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{it.strength}</p>}
          {it.directionLine && <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{it.directionLine}</p>}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {it.status !== "confirmed" && (
              <button type="button" disabled={busy !== null} onClick={() => act(it.rootId, "confirm")} className="rounded-full border border-line px-3 py-1 text-[13px] text-foreground disabled:opacity-50">
                맞아요
              </button>
            )}
            <button type="button" disabled={busy !== null} onClick={() => act(it.rootId, "reject")} className="rounded-full border border-line px-3 py-1 text-[13px] text-foreground disabled:opacity-50">
              아니에요
            </button>
            <button type="button" disabled={busy !== null} onClick={() => act(it.rootId, "remove")} className="rounded-full border border-line px-3 py-1 text-[13px] text-slate-500 disabled:opacity-50">
              지우기
            </button>
          </div>
        </div>
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
