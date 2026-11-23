import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usageRow, type UsageEvent, type UsageScope } from "./usageRow";

// AI 호출마다 토큰 수를 ai_usage_log에 남긴다(2026-11-23). AI를 부르는 곳(lib/ai/* · 안전 분류 · 임베딩)이 호출 직후 recordUsage를 부른다.
// 누가·어느 대화인지는 요청마다 하나씩 두는 "사용량 범위"(withUsageScope)에서 읽는다 — 로그인 확인(getUserIdFromAuthHeader)이 사용자를,
// 채팅 라우트가 대화 id를 채운다. after()로 보낸 뒤 작업도 같은 범위를 이어받는다(Next가 콜백을 만든 자리의 비동기 문맥으로 실행).
// 기록은 응답을 늦추지 않게 after()로 미루고, 실패해도 채팅에는 영향이 없다(기록이 빠질 뿐). SW_USAGE_LOG=0이면 끈다.
const scopeStore = new AsyncLocalStorage<UsageScope>();

export function withUsageScope<T>(route: string, fn: () => Promise<T>): Promise<T> {
  return scopeStore.run({ route }, fn);
}

export function setUsageUser(userId: string | null | undefined): void {
  const s = scopeStore.getStore();
  if (s && userId && !s.userId) s.userId = userId;
}

export function setUsageSession(sessionId: string | null | undefined): void {
  const s = scopeStore.getStore();
  if (s && sessionId) s.sessionId = sessionId;
}

let warned = false; // 표가 아직 없을 때(마이그레이션 전) 로그가 쌓이지 않게 인스턴스당 한 번만 알린다
let noCachedCol = false; // cached_input_tokens 칸 마이그레이션(20261123000100) 전이면 그 칸 없이 기록한다
export function recordUsage(e: UsageEvent): void {
  if (process.env.SW_USAGE_LOG === "0") return;
  const row = usageRow(scopeStore.getStore(), e);
  if (row.input_tokens === 0 && row.output_tokens === 0) return;
  const write = async () => {
    try {
      const admin = createAdminClient();
      const { cached_input_tokens: _cached, ...base } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
      let { error } = await admin.from("ai_usage_log").insert(noCachedCol ? base : row);
      if (error?.code === "PGRST204" && !noCachedCol) { // 칸이 아직 없음 → 그 칸 없이 다시
        noCachedCol = true;
        ({ error } = await admin.from("ai_usage_log").insert(base));
      }
      if (error && !warned) {
        warned = true;
        console.warn("AI 사용량 기록 실패:", error.code);
      }
    } catch {
      // 기록은 부가 기능 — 실패해도 조용히 넘어간다
    }
  };
  try {
    after(write);
  } catch {
    void write(); // 요청 밖(after를 쓸 수 없는 곳)
  }
}
