"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Message = { id: number; role: "user" | "assistant"; content: string };

// 첫 인사말 (초안). 시스템 프롬프트의 Identity/Goal 섹션과 같은 취지로 작성.
const GREETING =
  "안녕하세요, 쏠 웰니스 하우스예요. 요즘 마음에 머무는 이야기가 있다면 편하게 들려주세요. 저는 의사나 의료기관을 대신하지 않고, 생각을 함께 정리하도록 돕는 AI예요.";

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;
    // C1 단계: AI는 아직 연결되지 않았습니다. (C5에서 /api/chat으로 교체)
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", content: text },
      {
        id: nextId.current++,
        role: "assistant",
        content: "(개발 중) AI 연결은 다음 단계에서 붙습니다.",
      },
    ]);
    setInput("");
  }

  function newChat() {
    setMessages([]);
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white shadow-sm sm:border-x sm:border-line">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Image
          src="/logo.jpg"
          alt="쏠 웰니스 하우스"
          width={832}
          height={180}
          priority
          className="h-8 w-auto"
        />
        <button
          type="button"
          onClick={newChat}
          className="rounded-full border border-navy px-3 py-1.5 text-sm font-medium text-navy active:bg-navy-soft"
        >
          새 대화
        </button>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <Bubble role="assistant" content={GREETING} />
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        <div ref={endRef} />
      </main>

      <footer className="border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 한글 입력 중(조합 중)에는 Enter를 전송으로 처리하지 않음
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="마음에 있는 이야기를 적어주세요"
            aria-label="메시지 입력"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-background px-4 py-2.5 text-[15px] leading-6 outline-none focus:border-navy"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="h-11 shrink-0 rounded-2xl bg-navy px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            보내기
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
          의료 상담을 대체하지 않아요 · 힘들 때{" "}
          <a href="tel:109" className="font-medium text-navy underline">
            ☎109
          </a>{" "}
          <a href="tel:15770199" className="font-medium text-navy underline">
            ☎1577-0199
          </a>{" "}
          (24시간)
        </p>
      </footer>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-6 ${
          isUser ? "bg-navy text-white" : "bg-navy-soft text-foreground"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
