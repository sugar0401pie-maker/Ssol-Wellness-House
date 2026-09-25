"use client";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  QUESTIONS,
  PHASE_LABELS,
  OTHER_CODE,
  OTHER_MAX_CHARS,
  isOtherTextValid,
  nonWhitespaceCount,
  phaseOf,
  type QuestionDef,
  type BranchDef,
} from "@/lib/onboarding/schema";
import { toggleRank, rankOf, toRankedAnswers } from "@/lib/onboarding/rankSelect";

// 2026-09-25: SSOL_Onboarding_Development_Spec_v1_0 구현. 회원가입 직후 첫 채팅 진입 시
// 반드시 거쳐야 하는 9문항 온보딩(gate 모드)이자, 마이페이지에서 다시 열어 답을 고치는
// 화면(edit 모드)이기도 하다 — 문항 구성과 검증 로직이 완전히 같아서 한 컴포넌트로 둔다.
type Answers = Record<string, unknown>;
type OtherTexts = Record<string, string>;

type Props = {
  nickname: string | null;
  title?: string;
  mode: "gate" | "edit";
  onDone: () => void;
  onClose?: () => void; // edit 모드에서만 사용(취소하고 닫기)
};

function activeBranch(q: QuestionDef, answers: Answers): BranchDef | null {
  if (!q.branches) return null;
  const parentAnswer = answers[q.id];
  for (const b of q.branches) {
    const whenList = Array.isArray(b.when) ? b.when : [b.when];
    if (typeof parentAnswer === "string" && whenList.includes(parentAnswer)) return b;
  }
  return null;
}

export default function OnboardingFlow({ nickname, title, mode, onDone, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0); // 0..8 = QUESTIONS, 9 = 동의 화면
  const [answers, setAnswers] = useState<Answers>({});
  const [otherTexts, setOtherTexts] = useState<OtherTexts>({});
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/onboarding", { headers: authHeaders(token) });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { answers: Record<string, unknown>; resumeStep?: number };
        if (cancelled) return;
        const { other_answers, ...rest } = data.answers as { other_answers?: Record<string, string> };
        setAnswers(rest);
        setOtherTexts(other_answers ?? {});
        if (mode === "gate" && typeof data.resumeStep === "number") setStepIndex(data.resumeStep);
      } catch {
        // 불러오기 실패해도 빈 상태로 처음부터 진행 가능하게 둔다.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSteps = QUESTIONS.length; // 9
  const isConsentScreen = stepIndex >= totalSteps;
  const question = !isConsentScreen ? QUESTIONS[stepIndex] : null;
  const branch = question ? activeBranch(question, answers) : null;

  async function saveField(questionId: string, value: unknown, otherText?: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ questionId, value, otherText, step: stepIndex }),
      });
    } catch {
      // 자동 저장 실패는 조용히 넘어간다 — 마지막 완료 시점에 다시 한 번 전체 저장 기회가 있다.
    }
  }

  function setAnswer(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function clearBranchIfClosed(q: QuestionDef, newParentAnswer: unknown) {
    if (!q.branches) return;
    for (const b of q.branches) {
      const whenList = Array.isArray(b.when) ? b.when : [b.when];
      const stillOpen = typeof newParentAnswer === "string" && whenList.includes(newParentAnswer);
      if (!stillOpen) {
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[b.id];
          return next;
        });
        setOtherTexts((prev) => {
          const next = { ...prev };
          delete next[b.id];
          return next;
        });
      }
    }
  }

  function handleSingle(q: QuestionDef | BranchDef, code: string) {
    setAnswer(q.id, code);
    if ("branches" in q) clearBranchIfClosed(q, code);
  }

  function handleMulti(q: QuestionDef | BranchDef, code: string) {
    const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
    const exclusive = "exclusive" in q ? (q.exclusive ?? []) : [];
    let next: string[];
    if (current.includes(code)) {
      next = current.filter((c) => c !== code);
    } else if (exclusive.includes(code)) {
      next = [code];
    } else {
      const withoutExclusive = current.filter((c) => !exclusive.includes(c));
      const max = "maxSelect" in q ? q.maxSelect : undefined;
      if (max && withoutExclusive.length >= max) return; // 최대 개수 도달 — 무시
      next = [...withoutExclusive, code];
    }
    setAnswer(q.id, next);
  }

  function handleRank(q: QuestionDef, code: string) {
    const current = Array.isArray(answers[q.id])
      ? (answers[q.id] as { key: string }[]).map((x) => x.key)
      : [];
    const next = toggleRank(current, code, { maxRank: q.maxRank ?? 3, exclusiveCodes: q.exclusive });
    setAnswer(q.id, toRankedAnswers(next, otherTexts[q.id]));
  }

  function otherTextFor(id: string): string {
    return otherTexts[id] ?? "";
  }
  function setOtherText(id: string, text: string) {
    setOtherTexts((prev) => ({ ...prev, [id]: text.slice(0, OTHER_MAX_CHARS) }));
  }

  // 지금 화면(부모+분기 문항)에서 "기타"가 선택됐는데 아직 유효하지 않은 게 있는지.
  function hasInvalidOther(q: QuestionDef | BranchDef): boolean {
    const val = answers[q.id];
    const selectedOther =
      val === OTHER_CODE ||
      (Array.isArray(val) &&
        val.some((v) => v === OTHER_CODE || (v && typeof v === "object" && "key" in v && v.key === OTHER_CODE)));
    if (!selectedOther) return false;
    return !isOtherTextValid(otherTextFor(q.id));
  }

  function hasAnswer(q: QuestionDef | BranchDef): boolean {
    const val = answers[q.id];
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }

  const canProceed = useMemo(() => {
    if (!question) return true;
    if (hasInvalidOther(question)) return false;
    if (branch && hasInvalidOther(branch)) return false;
    return hasAnswer(question) && (!branch || hasAnswer(branch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, branch, answers, otherTexts]);

  async function goNext() {
    if (!question) return;
    setSaving(true);
    await saveField(question.id, answers[question.id] ?? null, otherTextFor(question.id));
    if (branch) await saveField(branch.id, answers[branch.id] ?? null, otherTextFor(branch.id));
    setSaving(false);
    setStepIndex((i) => i + 1);
  }

  async function goSkip() {
    if (!question) return;
    setAnswer(question.id, null);
    if (branch) setAnswer(branch.id, null);
    setSaving(true);
    await saveField(question.id, null);
    setSaving(false);
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setSaving(false);
      setError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ consent }),
      });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setError("저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
        <p className="text-[13px] text-white">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="border-b border-line px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[19px] font-semibold leading-6 text-navy">쏠 웰니스 하우스에 가입해주신 여러분을 환영합니다!</p>
            {mode === "edit" && onClose && (
              <button type="button" onClick={onClose} className="text-[12px] text-slate-400">
                닫기
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            {nickname ? `${nickname}님의` : "회원님의"} 관심사에 맞는 채팅을 위해서 사전 조사를 하고있어요. 잠깐만 시간
            내주실래요?
          </p>
          {!isConsentScreen && (
            <>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>{PHASE_LABELS[phaseOf(stepIndex)]}</span>
                <span>
                  {stepIndex + 1} / {totalSteps}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-navy transition-all"
                  style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!isConsentScreen && question && (
            <div className="flex flex-col gap-5">
              <QuestionBlock
                q={question}
                answer={answers[question.id]}
                otherText={otherTextFor(question.id)}
                onSingle={(c) => handleSingle(question, c)}
                onMulti={(c) => handleMulti(question, c)}
                onRank={(c) => handleRank(question, c)}
                onOtherText={(t) => setOtherText(question.id, t)}
              />
              {branch && (
                <div className="rounded-xl bg-background p-3">
                  <QuestionBlock
                    q={branch}
                    answer={answers[branch.id]}
                    otherText={otherTextFor(branch.id)}
                    onSingle={(c) => handleSingle(branch, c)}
                    onMulti={(c) => handleMulti(branch, c)}
                    onRank={() => {}}
                    onOtherText={(t) => setOtherText(branch.id, t)}
                  />
                </div>
              )}
            </div>
          )}

          {isConsentScreen && (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] font-medium leading-6 text-foreground">
                {nickname ? `${nickname}${title ? ` ${title}` : ""}님, ` : ""}응답해주셔서 감사해요.
              </p>
              <p className="text-[13px] leading-5 text-slate-500">
                답변은 매일의 실천방법 제안을 사용자에게 더 맞게 고르는 데만 활용돼요. AI 채팅에서는 지금 나누는 대화가
                항상 이 답변보다 우선해요. 마이페이지에서 언제든 답변을 다시 수정하거나 삭제할 수 있어요.
              </p>
              <label className="flex items-start gap-2 text-[13px] leading-5 text-foreground">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span>답변을 AI 채팅 개인화에 활용하는 것에 동의합니다. (선택 — 동의하지 않아도 채팅은 그대로 이용할 수 있어요.)</span>
              </label>
              {error && <p className="text-[13px] text-red-600">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-line px-5 py-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-foreground disabled:opacity-40"
            >
              이전
            </button>
          )}
          {!isConsentScreen && (
            <button
              type="button"
              onClick={() => void goSkip()}
              disabled={saving}
              className="h-11 rounded-xl border border-line px-4 text-[14px] font-medium text-slate-500 disabled:opacity-40"
            >
              건너뛰기
            </button>
          )}
          {!isConsentScreen ? (
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={saving || !canProceed}
              className="h-11 flex-1 rounded-xl bg-navy text-[14px] font-medium text-white disabled:opacity-40"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              className="h-11 flex-1 rounded-xl bg-navy text-[14px] font-medium text-white disabled:opacity-40"
            >
              {saving ? "저장하는 중…" : "완료"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionBlock({
  q,
  answer,
  otherText,
  onSingle,
  onMulti,
  onRank,
  onOtherText,
}: {
  q: QuestionDef | BranchDef;
  answer: unknown;
  otherText: string;
  onSingle: (code: string) => void;
  onMulti: (code: string) => void;
  onRank: (code: string) => void;
  onOtherText: (text: string) => void;
}) {
  const type = q.type;
  const isOtherSelected =
    answer === OTHER_CODE ||
    (Array.isArray(answer) &&
      answer.some((v) => v === OTHER_CODE || (v && typeof v === "object" && "key" in v && v.key === OTHER_CODE)));
  const otherLen = nonWhitespaceCount(otherText);

  const description = "description" in q ? q.description : undefined;

  return (
    <div>
      <p className="text-[15px] font-medium leading-6 text-foreground">{q.title}</p>
      {description && <p className="mt-1 text-[12.5px] leading-5 text-slate-400">{description}</p>}
      <div className="mt-2.5 flex flex-col gap-2">
        {q.options.map(([code, label]) => {
          if (type === "single") {
            const selected = answer === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => onSingle(code)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-[14px] ${
                  selected ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
                }`}
              >
                {label}
              </button>
            );
          }
          if (type === "multi") {
            const selected = Array.isArray(answer) && (answer as string[]).includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => onMulti(code)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-[14px] ${
                  selected ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
                }`}
              >
                {label}
              </button>
            );
          }
          // ranked
          const rankedList = Array.isArray(answer) ? (answer as { key: string }[]).map((x) => x.key) : [];
          const rank = rankOf(rankedList, code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => onRank(code)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14px] ${
                rank ? "border-navy bg-navy-soft text-navy" : "border-line text-foreground"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${
                  rank ? "border-navy bg-navy text-white" : "border-slate-300 text-transparent"
                }`}
              >
                {rank ?? "○"}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {isOtherSelected && (
        <div className="mt-2.5">
          <textarea
            value={otherText}
            onChange={(e) => onOtherText(e.target.value)}
            placeholder="직접 적어주세요 (10자 이상)"
            rows={2}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-[14px] outline-none focus:border-navy"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className={otherLen < 10 ? "text-red-500" : "text-slate-400"}>
              {otherLen < 10 ? "기타 내용을 10자 이상 작성해 주세요." : "입력 완료"}
            </span>
            <span className="text-slate-400">{otherLen}/10자</span>
          </div>
        </div>
      )}
    </div>
  );
}
