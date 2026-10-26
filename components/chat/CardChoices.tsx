"use client";

import { useState } from "react";
import type { CardPayload, CardPick } from "@/lib/cards/flow";

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

  if (card.kind === "confirm") {
    return (
      <div className="flex flex-wrap gap-1.5 pl-1">
        {card.options.map((o) => (
          <button key={o.id} type="button" disabled={disabled} className={chip} onClick={() => onPick({ confirm: o.id as "CF-1" | "CF-2" | "CF-3" }, o.label)}>
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
