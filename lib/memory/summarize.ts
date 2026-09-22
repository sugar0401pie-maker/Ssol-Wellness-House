import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/ai/chatModel";

const MAX_SUMMARY_CHARS = 1000; // user_memory.summary의 DB 제약과 동일 (developer_config 권장치: 500~1000자)

/**
 * 사용자가 "이 대화를 기억하기"를 선택했을 때만 호출된다 (동의 기반, 자동 아님).
 * 위기(crisis)·폭력(violence) route로 표시된 메시지는 절대 요약에 포함하지 않는다.
 * 이미 반영된 세션(memory_used_at 있음)은 다시 처리하지 않고 성공으로 취급한다.
 */
export async function summarizeSessionIntoMemory(
  userId: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("chat_sessions")
    .select("session_id, memory_used_at")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session) return { ok: false, reason: "세션을 찾을 수 없습니다." };
  if (session.memory_used_at) return { ok: true }; // 이미 반영됨 — 중복 처리하지 않음

  const { data: messages } = await admin
    .from("chat_messages")
    .select("role, content, route")
    .eq("session_id", sessionId)
    .order("created_at");

  const safeMessages = (messages ?? []).filter((m) => m.route !== "crisis" && m.route !== "violence");

  if (!safeMessages.length) {
    // 위기·폭력 메시지만 있었거나 대화가 비어 있었던 경우: 요약할 안전한 내용이 없다.
    await admin.from("chat_sessions").update({ memory_used_at: new Date().toISOString() }).eq("session_id", sessionId);
    return { ok: true };
  }

  const { data: existing } = await admin.from("user_memory").select("summary").eq("user_id", userId).maybeSingle();
  const transcript = safeMessages.map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`).join("\n");

  const system = [
    "너는 SSOL 웰니스 AI가 다음에 이 사용자와 대화할 때 참고할 짧은 메모를 만든다.",
    `아래는 기존 메모(있다면)와 이번 대화 내용이다. 이를 반영해 ${MAX_SUMMARY_CHARS}자 이내로 간결하게 갱신하라.`,
    "사용자가 반복해서 다루는 주제, 선호하는 표현 방식, 최근 상황 맥락 정도만 담는다.",
    "진단, 성격·유형 단정, 확정적 판단을 하지 않는다. 이름·연락처 등 불필요한 개인정보는 넣지 않는다.",
    "메모 문장만 출력하고, 다른 설명은 붙이지 않는다.",
  ].join("\n");
  const userInput = existing?.summary
    ? `기존 메모:\n${existing.summary}\n\n이번 대화:\n${transcript}`
    : `이번 대화:\n${transcript}`;

  let summary: string;
  try {
    const result = await generateReply(system, [{ role: "user", content: userInput }]);
    summary = result.text.slice(0, MAX_SUMMARY_CHARS);
  } catch (e) {
    console.error("대화 요약 생성 실패:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "요약을 만드는 중 문제가 발생했습니다." };
  }

  const { error: upsertErr } = await admin
    .from("user_memory")
    .upsert({ user_id: userId, summary, updated_at: new Date().toISOString() });
  if (upsertErr) return { ok: false, reason: "메모 저장에 실패했습니다." };

  await admin.from("chat_sessions").update({ memory_used_at: new Date().toISOString() }).eq("session_id", sessionId);
  return { ok: true };
}
