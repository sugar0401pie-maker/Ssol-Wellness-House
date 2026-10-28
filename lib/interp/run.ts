import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClassifierModel, CLASSIFIER_MODEL_NAME } from "@/lib/ai/classifierModel";
import * as RS from "./vendor/rootState.mjs";
import { classifyUtterance } from "./classify";
import { getClassifierData } from "./dataStore";
import { embedTexts } from "./embed";
import { interpRoutes, shouldAnalyze } from "./gate";
import { interpListed } from "./listed";
import { maskEvents } from "./healthMask";
import { trainingAllowed } from "@/lib/profile/aiTraining";
import { handleAnswer } from "./hypothesis";
import { syncTestEvidence } from "./testSync";
import { syncOnboardingEvidence } from "./onboardingSync";
import { syncAstroEvidence } from "./astroSync";
import { CARD_ROUTES } from "@/lib/cards/flow";
import { cardsOnFor } from "@/lib/cards/offer";
import { noteScene } from "@/lib/cards/session";
import { detectTheoryExclusion } from "@/lib/theory/exclusion";
import { SPEC_VERSION } from "./version";
import { recordDeepeningTurn } from "./deepeningFlow";
import { recordGrowth } from "./growth";

// 답변을 보낸 뒤 뒤에서 도는 발화 해석(2026-10-18). 결과는 다음 턴부터 반영된다(지연 0).
// 흐름: 켜짐·대상 확인 → 분류(임베딩 후보 + 모델) → 장부에서 상태 다시 읽기 → 같은 의미 한 번만 반영 → sw_apply_ops(원자적·멱등) → 판정 기록.
// 실패해도 채팅에는 영향이 없고, 대화 내용은 로그에 남기지 않는다(CLAUDE.md §8). 위기·폭력은 이 경로에 오지 않는다(앞 단계에서 끝남).
export { SPEC_VERSION };

export type InterpParams = {
  userId: string;
  sessionId: string;
  messageId: string;
  text: string;
  route: string;
  lastBot?: string | null;
};

async function work(p: InterpParams, at: (stage: string) => void): Promise<void> {
  {
    const env = process.env as { SW_INTERP_ENABLED?: string; SW_INTERP_ALLOWLIST?: string };
    if (env.SW_INTERP_ENABLED === "0") return; // 끄기 스위치
    const admin = createAdminClient();
    // 가설을 말한 직후의 답("맞아요")은 짧아서 아래 분석 기준에 안 걸리므로, 분석 여부와 상관없이 먼저 답을 받는다.
    if (await interpListed(admin, p.userId)) {
      // 심리테스트 결과를 근거로 합친다(다음 턴 이후의 가설·실천 순서에 쓰인다). 실패해도 계속한다.
      at("test");
      await syncTestEvidence(admin, p.userId).catch((e) => console.error("테스트 근거 반영 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
      // 온보딩 답(개인화 동의 + 끝낸 사용자)을 근거로 합친다. 실패해도 계속한다. 끄기: SW_ONBOARDING_CUES=0
      at("onboarding");
      await syncOnboardingEvidence(admin, p.userId).catch((e) => console.error("온보딩 근거 반영 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
      // 점성술 결과(답 Q1~Q3·유형·태양 별자리)를 근거로 합친다. 실패해도 계속한다. 끄기: SW_ASTRO_CUES=0
      at("astro");
      await syncAstroEvidence(admin, p.userId).catch((e) => console.error("점성술 근거 반영 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
      at("answer");
      await handleAnswer(admin, p).catch((e) => console.error("가설 답 처리 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
    }
    if (!shouldAnalyze(p.route, p.text, interpRoutes(process.env.SW_INTERP_ROUTES))) return;
    if (!(await interpListed(admin, p.userId))) return;

    at("data");
    const { index } = await getClassifierData(admin);
    at("classify");
    const cls = await classifyUtterance(
      p.text,
      { lastBot: p.lastBot ?? null, messageId: p.messageId, chatId: p.sessionId },
      { embed: embedTexts, index, callModel: callClassifierModel },
    );
    if (cls.safety_suspect) return; // 위기로 보이는 말 — 점수를 만들지 않는다(판단은 lib/safety)
    // 2026-10-20(로드맵 3·4번): 분류기가 선택지 카드 장면을 처음 꺼낸 말로 읽었다면 "열 준비" 세션을 만든다(보여 주는 것은 이어지는 다음 말에서).
    if (cls.scene_key && CARD_ROUTES.has(p.route) && !detectTheoryExclusion(p.text) && (await cardsOnFor(admin, p.userId))) {
      await noteScene(admin, p.userId, p.sessionId, cls.scene_key).catch((e) => console.error("카드 장면 기록 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
    }
    // 성장 방향·동기 위치(CSO 제1장): 방향 claim은 뿌리 사건을 만들지 않으므로 "사건이 없으면 끝" 앞에서 기록한다. 실패해도 채팅에는 영향이 없다. 끄기: SW_GROWTH=0
    if (cls.claims?.length) {
      at("growth");
      const rootIds = [...new Set(cls.events.filter((e) => e.op === "apply").map((e) => e.root_id))];
      await recordGrowth(admin, { userId: p.userId, sessionId: p.sessionId, messageId: p.messageId, text: p.text, lastBot: p.lastBot ?? null, claimIds: cls.claims.map((c) => c.claim_id), sceneKey: cls.scene_key ?? null, rootIds }).catch((e) => console.error("성장 방향 기록 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
    }
    if (!cls.events.length) return;

    // 장부에 저장하는 사용자 말 조각: 질병명·진단·약 같은 직접 건강 표현은 "[건강]"으로 가린다(owner 결정 2026-10-18 — 대화는 그대로 들어 주고
    // 저장되는 조각에서만 가린다. 감정·컨디션 표현은 남음). SW_STORE_EVIDENCE=0이면 조각 자체를 저장하지 않는다.
    // 마이페이지에서 학습 활용을 거부한 사용자는 문장 조각을 저장하지 않는다(점수·제안용 기록은 그대로) — 2026-10-18 owner 결정.
    const allowText = trainingAllowed(await admin.from("profiles").select("ai_training_consent").eq("user_id", p.userId).maybeSingle());
    const events = maskEvents(process.env.SW_STORE_EVIDENCE === "0" || !allowText ? cls.events.map((e) => ({ ...e, evidence: undefined })) : cls.events);
    at("ledger");
    const { data: ledger, error: le } = await admin.rpc("sw_read_ledger", { p_user: p.userId });
    if (le) throw new Error(`sw_read_ledger ${le.code}`);
    const states = RS.hydrate(p.userId, ledger ?? [], []);
    const sink: unknown[] = [];
    RS.applyChatClaims(states, p.userId, events, sink);
    if (sink.length) {
      const { error } = await admin.rpc("sw_apply_ops", { p_user: p.userId, p_ops: sink });
      if (error) throw new Error(`sw_apply_ops ${error.code}`);
    }

    // 깊어짐(③): 이 말이 가리킨 1순위 뿌리의 "다룬 턴"을 세고 깊어짐 신호를 판별한다(판별은 규칙, AI 없음). 실패해도 채팅에는 영향이 없다.
    const topRoot = [...cls.events].filter((e) => e.op === "apply").sort((a, b) => b.confidence - a.confidence)[0]?.root_id;
    if (topRoot) {
      at("deepening");
      await recordDeepeningTurn(admin, { userId: p.userId, sessionId: p.sessionId, messageId: p.messageId, rootId: topRoot, text: p.text }).catch((e) => console.error("깊어짐 기록 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown"));
    }

    at("log");
    // 판정 기록(확률 보정용 재료) — 후보 전체와 누가 골랐는지. 사용자 반응(outcome)은 나중에 채운다.
    const applied = cls.events.filter((e) => e.op === "apply");
    const top = [...applied].sort((a, b) => b.confidence - a.confidence)[0];
    await admin.from("sw_hypothesis_log").insert({
      user_id: p.userId,
      chat_id: p.sessionId,
      candidates: cls.events.map((e) => ({ root_id: e.root_id, claim_id: e.claim_id, confidence: e.confidence, points: e.points, link: e.link, op: e.op })),
      chosen_root: top?.root_id ?? null,
      chosen_by: top ? "ai" : "none",
      model_version: CLASSIFIER_MODEL_NAME,
      spec_version: SPEC_VERSION,
    });
  }
}

const BUDGET_MS = 50_000; // 함수 최대 시간(60초) 안에 끝나도록 — 어느 단계든 멈추면 여기서 끊는다

export async function runInterpretation(p: InterpParams): Promise<void> {
  const t0 = Date.now();
  let stage = "start";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(p, (s) => { stage = s; }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`시간 초과(단계: ${stage})`)), BUDGET_MS); }),
    ]);
  } catch (e) {
    console.error("발화 해석 실패(채팅에는 영향 없음):", e instanceof Error ? e.message.slice(0, 120) : "unknown");
  } finally {
    if (timer) clearTimeout(timer);
    // 대화 내용은 남기지 않는다 — 걸린 시간과 마지막 단계만.
    console.info(`interp ms=${Date.now() - t0} stage=${stage}`);
  }
}
