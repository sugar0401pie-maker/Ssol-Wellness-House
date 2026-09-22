"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ensureAnonymousSession } from "@/lib/supabase/browser";

type Message = { id: number; role: "user" | "assistant"; content: string };

// 첫 인사말 (초안). 시스템 프롬프트의 Identity/Goal 섹션과 같은 취지로 작성.
const GREETING =
  "안녕하세요, 쏠 웰니스 하우스예요. 요즘 마음에 머무는 이야기가 있다면 편하게 들려주세요. 저는 의사나 의료기관을 대신하지 않고, 생각을 함께 정리하도록 돕는 AI예요.";

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function appendMessage(role: Message["role"], content: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, role, content }]);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    appendMessage("user", text);
    setSending(true);

    try {
      const token = await ensureAnonymousSession();
      if (!token) {
        appendMessage("assistant", "로그인 준비에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, sessionId: sessionId.current }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        appendMessage("assistant", body?.error ?? "잠시 문제가 있었어요. 다시 시도해주세요.");
        return;
      }

      const data = (await res.json()) as {
        sessionId: string;
        route: string;
        reply: string | null;
        done: boolean;
        note?: string;
      };
      sessionId.current = data.sessionId;

      // route 1(crisis)·2(violence)는 실제 고정 응답이 온다. 그 외(route 3~7)는 C5에서 답변 생성이
      // 붙기 전까지 어떤 route로 판정됐는지만 보여준다 (개발 확인용, 실제 서비스 문구 아님).
      appendMessage("assistant", data.reply ?? `(개발 중) 안전 판정: ${data.route} — ${data.note ?? ""}`);
    } catch {
      appendMessage("assistant", "네트워크 문제로 응답을 받지 못했어요. 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setMessages([]);
    setInput("");
    sessionId.current = null;
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
        {sending && <Bubble role="assistant" content="생각하는 중…" muted />}
        <div ref={endRef} />
      </main>

      <footer className="border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 한글 입력 중(조합 중)에는 Enter를 전송으로 처리하지 않음
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="마음에 있는 이야기를 적어주세요"
            aria-label="메시지 입력"
            disabled={sending}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-background px-4 py-2.5 text-[15px] leading-6 outline-none focus:border-navy disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
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

function Bubble({ role, content, muted }: { role: "user" | "assistant"; content: string; muted?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-6 ${
          isUser ? "bg-navy text-white" : "bg-navy-soft text-foreground"
        } ${muted ? "opacity-60" : ""}`}
      >
        {content}
      </div>
    </div>
  );
}
