"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { FEEDBACK_CATEGORIES, type FeedbackCategoryId } from "@/lib/feedback/categories";

// 2026-10-01 owner 요청: "건의하기" 누르면 먼저 개인정보 수집 안내 동의 화면이 뜨고,
// 동의해야 실제 의견 작성 폼으로 넘어간다. 문구는 owner가 그대로 준 텍스트를 그대로 쓴다.
type Step = "consent" | "form" | "done";

export default function CustomerFeedbackModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("consent");
  const [category, setCategory] = useState<FeedbackCategoryId | "">("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!category && !!content.trim();

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
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ category, content: content.trim(), agreed: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "접수에 실패했어요.");
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[15px] font-medium text-foreground">고객의 의견</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full px-2 py-1 text-slate-500">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === "consent" && (
            <div className="flex flex-col gap-4 text-[13.5px] leading-6 text-slate-600">
              <p className="text-[15px] font-medium text-foreground">등록 전 꼭 읽어주세요!</p>
              <p>
                불건전한 내용(예시 : 개인정보보안, 불충분한 증거 및 귀책 사유에 대한 개인 음해성 비방의 글)또는 광고성 게시물은
                사전 통보없이 삭제될 수 있으며, 장시간 많은 내용을 입력하시는 경우는 미리 텍스트로 저장을 한 후 복사하여
                등록하시기 바랍니다.
              </p>
              <p>
                고객님께서 접수해 주신 내용의 원활한 처리 및 사후관리를 위해 고객님의 성명과 연락처를 포함한 접수 내용을
                수집하고 위와 같은 목적 이외의 용도로 활용되거나 제공되지 않으며 접수하신 내용은 고객님의 동의 철회 요청 시
                까지 또는 전자상거래 등에서의 소비자보호에 관한 법률 [소비자의 불만 또는 분쟁처리에 관한 기록]에 의거 3년간
                안전하게 보관 됩니다.
              </p>
              <p>
                * 이상의 내용 이외의 개인정보취급(처리) 방침은 홈페이지(
                <a
                  href="https://www.ssolwellnesshouse.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-navy underline"
                >
                  www.ssolwellnesshouse.com
                </a>
                ) 상의 개인정보취급(처리)방침이 준용되오니 이를 참고해 주시기 바랍니다.
              </p>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="mt-2 h-11 rounded-xl bg-navy text-[14px] font-medium text-white"
              >
                여기에 동의합니다
              </button>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-[14px]">
              <div>
                <p className="mb-1 text-slate-400">분류*</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategoryId)}
                  className="h-10 w-full rounded-xl border border-line bg-background px-2 outline-none focus:border-navy"
                >
                  <option value="">선택해주세요</option>
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-slate-400">내용*</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="쏘웰라 이용에 불편이 있거나 제안사항이 있으실 경우 편하게 알려주세요."
                  className="w-full rounded-xl border border-line bg-background px-3 py-2 outline-none focus:border-navy"
                />
              </div>

              {error && <p className="text-[13px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="h-11 rounded-xl bg-navy text-[14px] font-medium text-white disabled:opacity-40"
              >
                {submitting ? "제출하는 중…" : "제출하기"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="py-8 text-center">
              <p className="text-[15px] font-medium text-foreground">의견이 접수됐어요.</p>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">소중한 의견 감사합니다. 확인 후 필요한 경우 연락드릴게요.</p>
              <button type="button" onClick={onClose} className="mt-5 h-10 rounded-xl bg-navy px-5 text-[14px] font-medium text-white">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
