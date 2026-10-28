import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { loadCardData } from "@/lib/cards/session";

// 온보딩 가설의 "대화 조각" 연결(OB-16, 엔진 ESM v2.4~)에 넘길 대화 사실 중 DB에서 읽어 오는 두 가지(2026-10-28).
type Admin = ReturnType<typeof createAdminClient>;

/** 이 사용자가 연 선택지 카드 세션의 장면 키 모음(엔진의 chat.cardScenes). 카드 세션이 없으면 빈 집합. */
export async function cardSceneKeys(admin: Admin, userId: string): Promise<Set<string>> {
  const { data, error } = await admin.from("sw_choice_sessions").select("started_card_id").eq("user_id", userId).limit(500);
  if (error || !data?.length) return new Set();
  const data2 = await loadCardData(admin);
  const byFirst = new Map(data2.scenes.map((s) => [s.first_card, s.key]));
  return new Set(data.map((r) => byFirst.get(String(r.started_card_id))).filter((k): k is string => !!k));
}

/** 분류기가 골랐던 "장면 신호" claim(CS-SCN-*) id 모음 — 뿌리 점수는 없고 "그 장면 이야기가 나왔다"는 표시만(sw_user_signals slot=scene.signal). */
export async function loadSceneSignalClaims(admin: Admin, userId: string): Promise<Set<string>> {
  const { data, error } = await admin.from("sw_user_signals").select("value").eq("user_id", userId).eq("slot", "scene.signal").is("retracted_at", null).is("hidden_at", null).limit(500);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => String((r.value as { claim_id?: string } | null)?.claim_id ?? "")).filter(Boolean));
}
