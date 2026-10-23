import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { emailOf } from "@/lib/interp/listed";
import {
  SCREEN_MARK, decideScreening, makeScreenMarker, outcomeFor, parseScreenMarker, type ScreenKind, type ScreenMarker,
} from "./screening";
import { SCREEN_OK, SCREEN_QUESTION, SCREEN_RISK, SCREEN_STOP_REPEAT, SCREEN_UNCLEAR } from "./screeningTexts";
import type { RouteId } from "./types";

// 스크리닝 흐름의 서버 쪽 연결(2026-10-23, 1단계: S1·S2). 판단은 screening.ts(순수), 여기서는 이 대화의 표시를 읽고 결과 응답을 만든다.
// 🔒 AI 호출 없음. 어떤 오류든 평소 대화로 넘기지 않고 더 조심스럽게… 가 원칙이지만, 표시를 못 읽는 경우는 "스크리닝 없음"으로 두고 기존 안전 라우터가 그대로 지킨다
// (스크리닝은 기존 라우터 위에 얹는 추가 장치이고, 기존 위기·폭력 처리는 이 모듈과 무관하게 먼저 동작한다).
type Admin = ReturnType<typeof createAdminClient>;

// 켜기: SW_SCREENING_ENABLED=1 (기본 꺼짐 — 상담사님이 고정 문구를 확정하기 전). SW_SCREENING_ALLOWLIST(사용자 id 또는 이메일, 쉼표 구분)가 있으면 그 사용자만.
export async function screeningOn(admin: Admin, userId: string): Promise<boolean> {
  const env = process.env as { SW_SCREENING_ENABLED?: string; SW_SCREENING_ALLOWLIST?: string };
  if (env.SW_SCREENING_ENABLED !== "1") return false;
  const list = env.SW_SCREENING_ALLOWLIST?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!list.length) return true;
  if (list.includes(userId.toLowerCase())) return true;
  const email = await emailOf(admin, userId);
  return !!email && list.includes(email.toLowerCase());
}

export type ScreeningReply = {
  reply: string;
  route: RouteId; // 이 응답을 저장할 때 붙일 route
  marker: string; // assistant 메시지의 reflection_signal_id
  raiseFlag: "crisis" | "elevated" | null; // 세션 안전 표시를 올릴지(위험 확인 시)
};

const textFor = (kind: ScreenKind, which: "risk" | "ok" | "unclear") => ({ risk: SCREEN_RISK, ok: SCREEN_OK, unclear: SCREEN_UNCLEAR })[which][kind];

export async function runScreening(p: {
  admin: Admin; userId: string; sessionId: string; message: string; recentMessages: { role: "user" | "assistant"; content: string }[]; routeIsFixed: boolean;
}): Promise<ScreeningReply | null> {
  try {
    if (!(await screeningOn(p.admin, p.userId))) return null;
    // 이 대화의 스크리닝 표시 전부 + 직전 쏘웰라 답변의 표시(질문 직후인지 알려고)
    const [marked, latest] = await Promise.all([
      p.admin.from("chat_messages").select("reflection_signal_id").eq("session_id", p.sessionId).eq("role", "assistant").like("reflection_signal_id", `${SCREEN_MARK}:%`).limit(50),
      p.admin.from("chat_messages").select("reflection_signal_id").eq("session_id", p.sessionId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (marked.error || latest.error) throw new Error("표시 조회 실패");
    const markers = (marked.data ?? []).map((m) => parseScreenMarker(m.reflection_signal_id)).filter((m): m is ScreenMarker => m !== null);
    const action = decideScreening({
      message: p.message,
      recentUserMessages: p.recentMessages.filter((m) => m.role === "user").map((m) => m.content),
      markers,
      pending: parseScreenMarker(latest.data?.reflection_signal_id),
      routeIsFixed: p.routeIsFixed,
    });
    if (action.type === "none") return null;
    if (action.type === "stop_repeat") {
      return { reply: SCREEN_STOP_REPEAT[action.kind], route: action.kind === "suicide" ? "crisis" : "violence", marker: makeScreenMarker(action.kind, "stop"), raiseFlag: null };
    }
    if (action.type === "ask") {
      return { reply: SCREEN_QUESTION[action.kind], route: "wellness", marker: makeScreenMarker(action.kind, "asked"), raiseFlag: null };
    }
    const out = outcomeFor(action.result);
    const risk = out.text === "risk";
    return {
      reply: textFor(action.kind, out.text),
      route: risk ? (action.kind === "suicide" ? "crisis" : "violence") : "wellness",
      marker: makeScreenMarker(action.kind, out.stage),
      raiseFlag: risk ? (action.kind === "suicide" ? "crisis" : "elevated") : null,
    };
  } catch (e) {
    console.warn("스크리닝 처리 실패, 기존 안전 라우터 흐름으로 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}
