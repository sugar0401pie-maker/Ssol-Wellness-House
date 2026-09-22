"use client";

import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { revealText } from "@/lib/ui/typewriter";
import { getStoredAccessCode } from "@/lib/security/accessCodeClient";
import { SUGGESTED_QUESTION_GROUPS } from "@/lib/persona/suggestedQuestions";

// /api/chat, /api/memory 호출에 공통으로 붙이는 헤더. AccessGate를 통과해야 이 화면이 보이므로
// 코드가 저장돼 있을 것이지만, 없어도(게이트 비활성 상태) 그냥 빈 값으로 보내면 서버가 알아서 통과시킨다.
function authHeaders(token: string): Record<string, string> {
  const code = getStoredAccessCode();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(code ? { "X-Access-Code": code } : {}),
  };
}

type Message = { id: number; role: "user" | "assistant"; content: string };

// 첫 인사말 (초안). 시스템 프롬프트의 Identity/Goal 섹션과 같은 취지로 작성.
const GREETING =
  "안녕하세요, 쏠 웰니스 하우스예요. 저는 웰니스 관련 상담에 도움을 드릴 수 있습니다. 요즘 마음에 머무는 이야기가 있다면 편하게 들려주시기 바랍니다.";

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [memoryPrompt, setMemoryPrompt] = useState<"idle" | "asking" | "saving">("idle");
  const [showSuggested, setShowSuggested] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);
  const cancelReveal = useRef<(() => void) | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => () => cancelReveal.current?.(), []); // 화면을 벗어나면 진행 중이던 연출 정리

  function appendMessage(role: Message["role"], content: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, role, content }]);
  }

  // 완성된(이미 안전 검사를 통과한) 답변을 타이핑되듯 보여준다.
  function revealAssistantMessage(fullText: string) {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, role: "assistant", content: "" }]);
    cancelReveal.current?.();
    cancelReveal.current = revealText(fullText, (partial) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: partial } : m)));
    });
  }

  async function send(text: string, options?: { isPersonaQuestion?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    appendMessage("user", trimmed);
    setSending(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        appendMessage("assistant", "로그인이 필요해요. 새로고침 후 다시 로그인해주세요.");
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionId.current,
          isPersonaQuestion: options?.isPersonaQuestion ?? false,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        appendMessage("assistant", body?.error ?? "잠시 문제가 있었어요. 다시 시도해주세요.");
        return;
      }

      const data = (await res.json()) as { sessionId: string; route: string; reply: string | null; note?: string };
      sessionId.current = data.sessionId;
      setSending(false); // "생각하는 중" 대신 타이핑 연출이 바로 이어지도록
      revealAssistantMessage(data.reply ?? `(개발 중) 안전 판정: ${data.route} — ${data.note ?? ""}`);
      return;
    } catch {
      appendMessage("assistant", "네트워크 문제로 응답을 받지 못했어요. 다시 시도해주세요.");
    }
    setSending(false);
  }

  function selectSuggestedQuestion(text: string) {
    setShowSuggested(false);
    void send(text, { isPersonaQuestion: true });
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    sessionId.current = null;
    setMemoryPrompt("idle");
  }

  function requestNewChat() {
    // 나눈 대화가 없으면 굳이 물어보지 않는다.
    if (!messages.length) {
      resetChat();
      return;
    }
    setMemoryPrompt("asking");
  }

  async function confirmNewChat(remember: boolean) {
    const currentSessionId = sessionId.current;
    if (remember && currentSessionId) {
      setMemoryPrompt("saving");
      try {
        const token = await getAccessToken();
        if (token) {
          await fetch("/api/memory", {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({ sessionId: currentSessionId }),
          });
        }
      } catch {
        // 기억 저장은 부가 기능이라, 실패해도 새 대화 시작을 막지 않는다.
      }
    }
    resetChat();
  }

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[15px] font-medium text-foreground">AI 채팅</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={requestNewChat}
            className="rounded-full border border-navy px-3 py-1.5 text-sm font-medium text-navy active:bg-navy-soft"
          >
            새 대화
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <Bubble role="assistant" content={GREETING} />
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {sending && <ThinkingBubble />}
        <div ref={endRef} />
      </main>

      <footer className="border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 한글 입력 중(조합 중)에는 Enter를 전송으로 처리하지 않음
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
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
            type="button"
            onClick={() => setShowSuggested(true)}
            className="h-11 shrink-0 rounded-2xl border border-line px-3 text-sm font-medium text-foreground active:bg-background"
          >
            추천 질문
          </button>
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="h-11 shrink-0 rounded-2xl bg-navy px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            보내기
          </button>
        </form>
        {/* 2026-09-22 결정: 위기 연락처 상시 노출 대신 브랜드 비전 문구로 교체(사용자 요청).
            실제 위기 감지 시 안내(109, 1577-0199 등)는 그 상황의 답변 자체에 그대로 포함된다. */}
        <p className="mt-2 text-center text-[11px] italic leading-4 text-slate-400">SSOL — 삶의 파도를 유영하는 힘</p>
      </footer>

      {memoryPrompt !== "idle" && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
            <p className="text-[15px] font-medium leading-6 text-foreground">이번 대화를 기억해 둘까요?</p>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
              다음에 대화할 때 참고할 수 있어요. 위기·폭력 관련 내용은 저장하지 않아요.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => confirmNewChat(true)}
                disabled={memoryPrompt === "saving"}
                className="h-10 rounded-xl bg-navy text-sm font-medium text-white disabled:opacity-60"
              >
                {memoryPrompt === "saving" ? "저장하는 중…" : "기억하기"}
              </button>
              <button
                type="button"
                onClick={() => confirmNewChat(false)}
                disabled={memoryPrompt === "saving"}
                className="h-10 rounded-xl border border-line text-sm font-medium text-foreground disabled:opacity-60"
              >
                기억하지 않기
              </button>
              <button
                type="button"
                onClick={() => setMemoryPrompt("idle")}
                disabled={memoryPrompt === "saving"}
                className="mt-1 text-[13px] text-slate-500 underline disabled:opacity-60"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuggested && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[15px] font-medium text-foreground">추천 질문</p>
              <button
                type="button"
                onClick={() => setShowSuggested(false)}
                aria-label="닫기"
                className="rounded-full px-2 py-1 text-slate-500"
              >
                닫기
              </button>
            </div>
            <p className="px-4 pt-3 text-[12px] leading-5 text-slate-500">
              웰니스 유형(성향) 테스트 결과를 바탕으로 답해요. 아직 테스트를 하지 않으셨다면 먼저 안내해드려요.
            </p>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {SUGGESTED_QUESTION_GROUPS.map((group) => (
                <div key={group.title} className="mt-4">
                  <p className="text-[12px] font-medium text-slate-400">{group.title}</p>
                  <div className="mt-1.5 divide-y divide-line rounded-xl border border-line">
                    {group.questions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => selectSuggestedQuestion(q.text)}
                        className="block w-full px-3.5 py-3 text-left text-[14px] leading-5 text-foreground active:bg-background"
                      >
                        {q.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "생각하는 중…" 대신 점 3개가 순서대로 튀어오르는 타이핑 인디케이터 (2026-09-22 결정:
// 글자가 가만히 있지 않고 움직이게 해달라는 요청 반영).
function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl bg-navy-soft px-4 py-2.5 text-[15px] leading-6 text-foreground">
        <span>생각하는 중</span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "0ms" }}>
          .
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "150ms" }}>
          .
        </span>
        <span className="ssol-thinking-dot" style={{ animationDelay: "300ms" }}>
          .
        </span>
      </div>
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
