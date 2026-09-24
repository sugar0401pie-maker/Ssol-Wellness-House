"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

type Props = {
  nickname: string | null;
  title: string;
  enjoymentOptions: readonly string[];
  concernOptions: readonly string[];
  onDone: () => void;
};

// 로그인 후 처음 접속하면 뜨는 "자기소개" 팝업. 닫기 버튼이 없다 — 반드시 답해야 홈 화면이
// 보인다(2026-09-24 결정: "반드시 먼저 체크하도록"). 닉네임은 여기서 바꿀 수 없고
// 마이페이지에서 바꾼다(테스트 응시 시 입력한 값을 기본으로 그대로 보여주기만 함).
export default function OnboardingModal({ nickname, title, enjoymentOptions, concernOptions, onDone }: Props) {
  const [enjoyment, setEnjoyment] = useState<string | null>(null);
  const [concern, setConcern] = useState<string | null>(null);
  const [concernOther, setConcernOther] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!enjoyment && !!concern && (concern !== "기타" || concernOther.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setSubmitting(false);
      setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ enjoyment, concern, concernOther: concern === "기타" ? concernOther.trim() : undefined }),
      });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setSubmitting(false);
      setError("저장에 실패했어요. 다시 시도해주세요.");
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <p className="text-[16px] font-medium leading-6 text-foreground">
          {nickname ? `${nickname} ${title}님, ` : ""}원활한 서비스 이용을 위해
          <br />
          자기 자신에 대해 알려주세요.
        </p>
        <p className="mt-1 text-[12px] text-slate-400">tell us about yourself for us to understand you better.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[14px] font-medium text-foreground">내가 주로 즐거움을 느끼는 부분에 대해 알려주세요.</p>
            <div className="grid grid-cols-2 gap-2">
              {enjoymentOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setEnjoyment(opt)}
                  className={`rounded-xl border px-3 py-2 text-[13px] ${
                    enjoyment === opt ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[14px] font-medium text-foreground">주요 고민거리에 대해 알려주세요.</p>
            <div className="grid grid-cols-2 gap-2">
              {concernOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setConcern(opt)}
                  className={`rounded-xl border px-3 py-2 text-[13px] ${
                    concern === opt ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {concern === "기타" && (
              <input
                type="text"
                value={concernOther}
                onChange={(e) => setConcernOther(e.target.value)}
                placeholder="어떤 고민인지 적어주세요"
                className="mt-2 h-11 w-full rounded-xl border border-line bg-background px-4 text-[15px] outline-none focus:border-navy"
              />
            )}
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="h-11 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "저장하는 중…" : "확인"}
          </button>
        </form>
      </div>
    </div>
  );
}
