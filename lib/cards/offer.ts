import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { emailOf } from "@/lib/interp/listed";
import { detectTheoryExclusion } from "@/lib/theory/exclusion";
import { detectTraumaStage } from "@/lib/safety/traumaStage";
import { hasCrisisHistory } from "@/lib/safety/crisisHistory";
import { CARD_ROUTES, cardsEnabled, type CardPayload } from "./flow";
import { abandonPending, cardMessageMark, endOffer, findOffer, presentFirstCard } from "./session";

// 채팅 API가 쓰는 카드 진입점(2026-10-20, 로드맵 3·4번). 기능이 꺼져 있으면 DB 조회 없이 즉시 돌아간다.
type Admin = ReturnType<typeof createAdminClient>;

export async function cardsOnFor(admin: Admin, userId: string): Promise<boolean> {
  const env = process.env as { SW_CARDS_ENABLED?: string; SW_CARDS_ALLOWLIST?: string };
  if (env.SW_CARDS_ENABLED !== "1") return false;
  return cardsEnabled(env, userId, env.SW_CARDS_ALLOWLIST?.trim() ? await emailOf(admin, userId) : null);
}

export type CardOfferPlan = {
  generationExtras: { dialogueMode: "card_follows" };
  // 답변 저장 뒤 호출: 첫 카드를 말풍선으로 저장하고 화면에 보낼 모양을 돌려준다(실패하면 undefined — 카드 없이 평소대로).
  finalize: (usedFallback: boolean) => Promise<{ text: string; choices: []; card: CardPayload } | undefined>;
};

export async function planCardOffer(p: {
  admin: Admin; userId: string; sessionId: string; route: string; message: string; recentUserMessages: string[]; otherFlowActive: boolean; tapped: boolean;
}): Promise<CardOfferPlan | null> {
  try {
    if (!(await cardsOnFor(p.admin, p.userId))) return null;
    if (p.tapped) return null;
    // 사용자가 카드 보기를 누르지 않고 글을 썼다면 보여 줬던 카드는 접는다(보기 밖 이야기로 이어간 것).
    await abandonPending(p.admin, p.userId, p.sessionId);
    if (!CARD_ROUTES.has(p.route) || p.otherFlowActive) return null;
    const offer = await findOffer(p.admin, p.userId, p.sessionId);
    if (!offer) return null;
    // 더 조심스러운 쪽: 사별·질병 등 이론 탐색을 닫는 상황, 트라우마 단계 신호, 위기 이력이 있는 계정에서는 카드를 열지 않는다.
    if (detectTheoryExclusion(p.message, p.recentUserMessages) || detectTraumaStage(p.message, p.recentUserMessages) || (await hasCrisisHistory(p.admin, p.userId))) {
      await endOffer(p.admin, p.userId, p.sessionId, "not_allowed");
      return null;
    }
    return {
      generationExtras: { dialogueMode: "card_follows" },
      finalize: async (usedFallback) => {
        if (usedFallback) return undefined;
        const payload = await presentFirstCard(p.admin, p.userId, p.sessionId);
        if (!payload) return undefined;
        const { error } = await p.admin.from("chat_messages").insert({
          session_id: p.sessionId, user_id: p.userId, role: "assistant", content: payload.text, route: p.route, reflection_signal_id: cardMessageMark(payload),
        });
        if (error) { await endOffer(p.admin, p.userId, p.sessionId, "save_failed"); return undefined; }
        return { text: payload.text, choices: [], card: payload };
      },
    };
  } catch (e) {
    console.warn("카드 제안 계획 실패, 카드 없이 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}
