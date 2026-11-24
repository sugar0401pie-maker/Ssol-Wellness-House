"use client";

import { useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// /pricing "오프라인 웰니스 세션을 이용 중이신가요?" — 2026-11-24 대표님 요청: 접어 두고, 펼치면 안내 + 이용 코드 입력창.
// 코드를 등록하면 정해진 기간 동안 채팅을 쓸 수 있다(app/api/billing/redeem-code — 코드는 scripts/make_access_codes.mjs로 만든다).
function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(d);
}

export default function OfflineSessionCode() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; expiresAt?: string | null } | null>(null);

  async function submit() {
    if (busy || !code.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("login");
      const res = await fetch("/api/billing/redeem-code", { method: "POST", headers: authHeaders(token), body: JSON.stringify({ code }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; expiresAt?: string | null };
      setResult({ ok: !!data.ok, message: data.message ?? "지금은 코드를 등록하지 못했어요. 잠시 후 다시 시도해 주세요.", expiresAt: data.expiresAt ?? null });
      if (data.ok) setCode("");
    } catch {
      setResult({ ok: false, message: "로그인 정보를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-line bg-background text-[13px] leading-5 text-slate-500">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between p-4 text-left">
        <span className="font-medium text-foreground">오프라인 웰니스 세션을 이용 중이신가요?</span>
        <span className="text-slate-400">{open ? "접기" : "보기"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p>오프라인 웰니스 세션 패키지를 이용하고 계신 분은 패키지별로 채팅을 무료로 이용하실 수 있어요.</p>
          <label htmlFor="offline-code" className="mt-3 block text-[12px] font-medium text-slate-500">
            이용 코드
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="offline-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void submit(); }}
              placeholder="받으신 코드를 입력해 주세요"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-[14px] tracking-wide text-foreground outline-none focus:border-navy"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !code.trim()}
              className="h-10 shrink-0 rounded-xl bg-navy px-4 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "등록 중…" : "코드 등록하기"}
            </button>
          </div>
          {result && (
            <div className={`mt-2 ${result.ok ? "text-navy" : "text-red-600"}`}>
              <p>
                {result.message}
                {result.ok && result.expiresAt ? ` ${formatDate(result.expiresAt)}까지 채팅을 이용할 수 있어요.` : ""}
              </p>
              {result.ok && (
                <Link href="/chat" className="mt-2 inline-block rounded-full bg-navy px-3 py-1.5 text-[13px] font-medium text-white">
                  채팅하러 가기
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
