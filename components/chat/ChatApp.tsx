"use client";

import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { revealText } from "@/lib/ui/typewriter";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { SUGGESTED_QUESTION_GROUPS, pickRandomSuggestedQuestions } from "@/lib/persona/suggestedQuestions";
import TrialPaywallOverlay from "./TrialPaywallOverlay";
import OnboardingFlow from "@/components/app/OnboardingFlow";
import { allOnboardingAnswersBlank } from "@/lib/onboarding/schema";

type Message = { id: number; role: "user" | "assistant"; content: string };
type SessionSummary = {
  sessionId: string;
  topicTag: string | null;
  startedAt: string;
  lastMessageAt: string;
  safetyFlag: "none" | "elevated" | "crisis";
};

// 첫 인사말 (초안). 시스템 프롬프트의 Identity/Goal 섹션과 같은 취지로 작성.
const GREETING =
  "안녕하세요, 쏠 웰니스 하우스예요. 저는 웰니스 관련 상담에 도움을 드릴 수 있습니다. 요즘 마음에 머무는 이야기가 있다면 편하게 들려주시기 바랍니다.";

// 2026-09-28: 홈/채팅/마이페이지가 "/home", "/chat", "/mypage" 개별 주소로 나뉘면서, 채팅 탭을
// 벗어났다 돌아오면 이 컴포넌트가 새로 마운트된다(예전엔 세 탭을 전부 마운트해두고 CSS로만
// 숨겨서 이 문제가 없었다). 지금 나누고 있던 대화가 사라지지 않도록, 활성 세션 id를
// localStorage에 저장해두고 마운트 시 자동으로 그 대화를 불러온다. 개인정보(대화 내용)는
// 저장하지 않고 세션 id만 저장한다 — 실제 메시지는 항상 서버에서 다시 불러온다.
const ACTIVE_SESSION_KEY = "ssol_active_chat_session";

function saveActiveSessionId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // 프라이빗 브라우징 등으로 localStorage를 못 쓰면 그냥 세션 복원 기능만 조용히 빠진다.
  }
}

// 대화 목록에 "언제"를 사람이 읽기 편하게 보여준다 — 오늘/어제는 시각만, 그 외엔 날짜만.
function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(d, now)) return `오늘 ${time}`;
  if (isSameDay(d, yesterday)) return `어제 ${time}`;
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [memoryPrompt, setMemoryPrompt] = useState<"idle" | "asking" | "saving">("idle");
  const [showSuggested, setShowSuggested] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [paywallBlocked, setPaywallBlocked] = useState(false);
  // 2026-09-28 owner 요청: 온보딩을 "닫기"로 건너뛴 사용자가 채팅에 들어오면, 첫 인사말
  // 바로 아래에 온보딩을 다시 열 수 있는 안내+버튼을 보여준다. 완료한 사용자에겐 안 보인다 —
  // 단, "완료" 처리는 됐어도 모든 문항을 건너뛰기만 해서 실제 답변이 하나도 없는 사람은
  // 예외로 동일하게 보여준다(showPrompt = 완료 안 함 OR 완료했지만 답변이 전부 비어있음).
  const [onboarding, setOnboarding] = useState<{
    completed: boolean;
    nickname: string | null;
    title: string;
    showPrompt: boolean;
  } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // 2026-09-28 owner 요청(시안 .chipq): 대화 시작 전(메시지가 아직 없을 때)엔 첫 인사말 밑에
  // 눌러볼 만한 질문 몇 개를 칩으로 랜덤 노출한다 — lazy initializer로 마운트 시 한 번만 뽑아서
  // 리렌더될 때마다 바뀌지 않게 한다. 대화가 시작되면(messages.length>0) 더 이상 안 보인다.
  const [starterChips] = useState(() => pickRandomSuggestedQuestions(3));
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);
  const cancelReveal = useRef<(() => void) | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => () => cancelReveal.current?.(), []); // 화면을 벗어나면 진행 중이던 연출 정리

  // 메시지를 보내보기 전에 미리 확인해서, 무료체험이 끝난 사용자는 바로 안내를 볼 수 있게 한다.
  // 최종 차단은 서버(app/api/chat)가 하므로, 이 조회가 실패하거나 느려도 안전에는 영향이 없다.
  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch("/api/billing/status", { headers: authHeaders(token) });
        if (!res.ok) return;
        const data = (await res.json()) as { allowed: boolean };
        if (!cancelled && !data.allowed) setPaywallBlocked(true);
      } catch {
        // 조회 실패 시엔 막지 않는다 — 실제 차단은 서버가 메시지를 보낼 때 한 번 더 확인한다.
      }
    }
    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkOnboarding() {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const res = await fetch("/api/onboarding", { headers: authHeaders(token) });
        if (!res.ok) return;
        const json = (await res.json()) as {
          completed: boolean;
          nickname: string | null;
          title: string;
          answers?: Record<string, unknown>;
        };
        if (!cancelled) {
          setOnboarding({
            completed: json.completed,
            nickname: json.nickname,
            title: json.title,
            showPrompt: !json.completed || allOnboardingAnswersBlank(json.answers),
          });
        }
      } catch {
        // 조회 실패해도 채팅 자체는 그대로 쓸 수 있어야 하므로 조용히 넘어간다(안내만 안 보임).
      }
    }
    void checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, []);

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

      const data = (await res.json()) as {
        sessionId: string;
        route: string;
        reply: string | null;
        note?: string;
        paywallBlocked?: boolean;
      };
      sessionId.current = data.sessionId;
      saveActiveSessionId(data.sessionId);
      setSending(false); // "생각하는 중" 대신 타이핑 연출이 바로 이어지도록
      revealAssistantMessage(data.reply ?? `(개발 중) 안전 판정: ${data.route} — ${data.note ?? ""}`);
      if (data.paywallBlocked) setPaywallBlocked(true);
      return;
    } catch {
      appendMessage("assistant", "네트워크 문제로 응답을 받지 못했어요. 다시 시도해주세요.");
    }
    setSending(false);
  }

  async function openHistory() {
    setShowHistory(true);
    setHistoryError(null);
    const token = await getAccessToken();
    if (!token) {
      setHistoryError("로그인 정보를 확인하지 못했어요. 새로고침해주세요.");
      return;
    }
    try {
      const res = await fetch("/api/chat/sessions", { headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      setHistoryError("대화 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  async function loadSession(id: string) {
    if (loadingSessionId) return;
    setLoadingSessionId(id);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/chat/sessions/${id}`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
      cancelReveal.current?.();
      nextId.current = 1;
      setMessages(data.messages.map((m) => ({ id: nextId.current++, role: m.role, content: m.content })));
      sessionId.current = id;
      saveActiveSessionId(id);
      setInput("");
      setMemoryPrompt("idle");
      setShowHistory(false);
    } catch {
      setHistoryError("대화를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoadingSessionId(null);
    }
  }

  // 2026-09-28: 채팅 탭을 벗어났다 돌아오면(별도 주소라 새로 마운트됨) 나누고 있던 대화를
  // 자동으로 이어서 보여준다.
  useEffect(() => {
    let savedId: string | null = null;
    try {
      savedId = localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
      // localStorage를 못 읽으면 그냥 새 대화로 시작한다.
    }
    // loadSession은 그 안에서 setState를 곧바로 호출하므로, 이펙트 본문에서 직접 부르지 않고
    // 마이크로태스크로 한 틱 미룬다(react-hooks/set-state-in-effect 회피).
    if (savedId) void Promise.resolve().then(() => loadSession(savedId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSuggestedQuestion(text: string) {
    setShowSuggested(false);
    void send(text, { isPersonaQuestion: true });
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    sessionId.current = null;
    saveActiveSessionId(null);
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
        {/* 2026-09-28: owner 확인 후 채팅 헤더를 "쏘웰라"로 변경(첫 화면에서 이 이름으로
            AI를 소개하므로) — 화면 안 대화 로직·API 이름 등은 그대로, 라벨만 바꾼 것. */}
        <p className="text-[15px] font-medium text-foreground">쏘웰라</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openHistory}
            className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-foreground active:bg-background"
          >
            지난 대화
          </button>
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
        {onboarding && onboarding.showPrompt && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-navy-soft px-4 py-2.5 text-[15px] leading-6 text-foreground">
              <p>
                온보딩 테스트를 하고 오시면 {onboarding.nickname ?? "회원"}님께 더 맞춤화된 답변을 받으실 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="mt-2 rounded-full bg-navy px-3 py-1.5 text-[13px] font-medium text-white"
              >
                온보딩 테스트 하기
              </button>
            </div>
          </div>
        )}
        {messages.length === 0 && starterChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {starterChips.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => void send(q.text, { isPersonaQuestion: true })}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] text-foreground active:border-navy active:text-navy"
              >
                {q.text}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {sending && <ThinkingBubble />}
        <div ref={endRef} />
      </main>

      {paywallBlocked ? (
        <TrialPaywallOverlay />
      ) : (
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
              // 2026-10-01 owner 요청: placeholder가 좁은 입력창 폭(옆에 "추천 질문"·"보내기"
              // 버튼이 있어서) 때문에 2줄로 잘려 보였다 — 1단계(15->14px) 줄여도 여전히
              // 2줄이라 1단계 더(14->13px) 줄였다. 13px에서도 여전히 2줄로 넘치긴 하지만
              // (글자 수 자체가 길어서 버튼 폭을 더 줄이지 않는 한 완전히 1줄로는 안 들어감),
              // 입력한 실제 텍스트 크기(text-[15px])는 그대로 두고 placeholder:text-[13px]로
              // placeholder에만 적용했다.
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-background px-4 py-2.5 text-[15px] leading-6 outline-none placeholder:text-[13px] focus:border-navy disabled:opacity-60"
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
      )}

      {showHistory && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[15px] font-medium text-foreground">지난 대화</p>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                aria-label="닫기"
                className="rounded-full px-2 py-1 text-slate-500"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {historyError && <p className="text-[13px] text-red-600">{historyError}</p>}
              {!historyError && sessions === null && (
                <p className="py-6 text-center text-[13px] text-slate-400">불러오는 중…</p>
              )}
              {!historyError && sessions?.length === 0 && (
                <p className="py-6 text-center text-[13px] text-slate-400">아직 나눈 대화가 없어요.</p>
              )}
              {sessions && sessions.length > 0 && (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {sessions.map((s) => (
                    <button
                      key={s.sessionId}
                      type="button"
                      onClick={() => loadSession(s.sessionId)}
                      disabled={loadingSessionId === s.sessionId}
                      className="block w-full px-3.5 py-3 text-left active:bg-background disabled:opacity-60"
                    >
                      <p className="text-[12px] text-slate-400">{formatSessionDate(s.startedAt)}</p>
                      <p className="mt-0.5 truncate text-[14px] leading-5 text-foreground">
                        {s.topicTag ?? "(내용 없음)"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {showOnboarding && onboarding && (
        <OnboardingFlow
          mode="gate"
          nickname={onboarding.nickname}
          title={onboarding.title}
          onDone={() => {
            setOnboarding({ ...onboarding, completed: true, showPrompt: false });
            setShowOnboarding(false);
          }}
          onClose={() => setShowOnboarding(false)}
        />
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
