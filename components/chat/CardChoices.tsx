"use client";

import { useState } from "react";
import type { CardPayload, CardPick, ConfirmId, TaskCheckAnswer, TaskResult } from "@/lib/cards/flow";

// 선택지 카드(2026-10-20, 로드맵 3·4번): 말풍선 아래 보기 칩. 보기 하나를 누르면 바로 보내고, "두 개 이상이에요"는 두 개를 고른 뒤 보낸다.
// "다른 이유가 있어요"는 입력창에 직접 쓰게 한다(부모가 입력창을 연다). 진단·점수가 아니라 이유를 함께 찾는 보기다.
const chip = "rounded-full border border-navy bg-white px-3.5 py-2 text-[13px] font-medium text-navy active:bg-navy-soft disabled:opacity-50";

export default function CardChoices({ card, disabled, onPick, onOther }: {
  card: CardPayload;
  disabled: boolean;
  onPick: (pick: CardPick, label: string) => void;
  onOther: (cardId: string) => void;
}) {
  const [multi, setMulti] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  // 2026-11-23(CSO 묶음 v2.32 · 규칙 WT-07): 갈래 카드 — "이 중에 지금 마음에 가까운 까닭이 있어요?" 갈래 문장이 길어 한 줄씩 버튼으로 보인다.
  // "다른 까닭이에요"·"잘 모르겠어요"도 같은 목록의 보기다(서버가 보여 준 보기만 받는다).
  if (card.kind === "branch") {
    return (
      <div className="space-y-1.5 pl-1">
        {card.options.map((o) => (
          <button key={o.id} type="button" disabled={disabled} onClick={() => onPick({ branch: { option: o.id } }, o.label)}
            className={o.id === "other" || o.id === "unknown"
              ? "rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-slate-600 active:bg-background disabled:opacity-50 mr-1.5"
              : "block w-full max-w-[85%] rounded-xl border border-navy bg-white px-3.5 py-2.5 text-left text-[13.5px] font-medium leading-5 text-navy active:bg-navy-soft disabled:opacity-50"}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  // 2026-11-18(3부-3): 작은 연습 고르기(task) · 해 보니 어땠는지(task_result) · 확인 질문(task_check). 연습 이름은 길어서 한 줄씩 버튼으로 보인다.
  // 2026-11-19(3부-4): 연습 전 짧은 질문(task_ask — 보기 번호) · "지금 같이 해 볼까요?"(task_mini).
  if (card.kind === "task" || card.kind === "task_result" || card.kind === "task_check" || card.kind === "task_ask" || card.kind === "task_mini") {
    const row = card.row ?? 0;
    const pickOf = (id: string): CardPick =>
      card.kind === "task" ? { task: { row, practice: id } }
      : card.kind === "task_result" ? { taskResult: { row, result: id as TaskResult } }
      : card.kind === "task_ask" ? { taskAsk: { row, option: Number(id) } }
      : card.kind === "task_mini" ? { taskMini: { row, choice: id === "now" ? "now" : "later" } }
      : { taskCheck: { row, answer: id as TaskCheckAnswer } };
    if (card.kind === "task" || card.kind === "task_ask") {
      return (
        <div className="space-y-1.5 pl-1">
          {card.options.map((o) => (
            <button key={o.id} type="button" disabled={disabled} onClick={() => onPick(pickOf(o.id), o.label)}
              className="block w-full max-w-[85%] rounded-xl border border-navy bg-white px-3.5 py-2.5 text-left text-[13.5px] font-medium leading-5 text-navy active:bg-navy-soft disabled:opacity-50">
              {o.label}
            </button>
          ))}
          {card.fixed.map((f) => (
            <button key={f.id} type="button" disabled={disabled} onClick={() => onPick({ task: { row, practice: "later" } }, f.label)}
              className="rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-slate-600 active:bg-background disabled:opacity-50">
              {f.label}
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5 pl-1">
        {card.options.map((o) => (
          <button key={o.id} type="button" disabled={disabled} className={chip} onClick={() => onPick(pickOf(o.id), o.label)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  // 2026-11-18(엔진 v0.17): 확인 카드는 4단계(딱 내 마음이에요 · 꽤 비슷해요 · 조금은 비슷해요 · 별로 아니에요), "딱 내 마음" 뒤에는 범위 질문 한 번.
  if (card.kind === "confirm" || card.kind === "scope") {
    return (
      <div className="flex flex-wrap gap-1.5 pl-1">
        {card.options.map((o) => (
          <button key={o.id} type="button" disabled={disabled} className={chip}
            onClick={() => onPick(card.kind === "scope" ? { scope: o.id as "CS-1" | "CS-2" } : { confirm: o.id as ConfirmId }, o.label)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));
  return (
    <div className="space-y-2 pl-1">
      <div className="flex flex-wrap gap-1.5">
        {card.options.map((o) => {
          const on = sel.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              aria-pressed={multi ? on : undefined}
              className={`${chip} ${multi && on ? "bg-navy text-white" : ""}`}
              onClick={() => (multi ? toggle(o.id) : onPick({ cardId: card.cardId, optionId: o.id }, o.label))}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {multi ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled || sel.length !== 2}
            className="rounded-full bg-navy px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
            onClick={() => onPick({ cardId: card.cardId, multi: [sel[0], sel[1]] }, sel.map((id) => card.options.find((o) => o.id === id)?.label ?? "").join(" / "))}
          >
            이대로 보내기
          </button>
          <span className="text-[12px] text-slate-500">가까운 보기를 두 개 골라 주세요 ({sel.length}/2)</span>
          <button type="button" className="text-[12px] text-slate-500 underline" onClick={() => { setMulti(false); setSel([]); }}>
            취소
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {card.fixed.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={disabled}
              className="rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-slate-600 active:bg-background disabled:opacity-50"
              onClick={() => {
                if (f.id === "FX-MULTI") setMulti(true);
                else if (f.id === "FX-DK") onPick({ cardId: card.cardId, dk: true }, f.label);
                else if (f.id === "FX-MORE") onPick({ cardId: card.cardId, more: true }, f.label);
                else if (f.id === "FX-STOP") onPick({ cardId: card.cardId, stop: true }, f.label);
                else onOther(card.cardId);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
