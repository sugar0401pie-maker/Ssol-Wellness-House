// 발화 한 번을 분류해 장부 사건(events)으로 바꾼다(2026-10-18). CSO 분류기(vendor/claimClassifier.mjs)의 프롬프트·검사·사건 변환을 그대로 쓰고,
// 후보 검색만 임베딩으로 바꿔 끼운다. 모델·임베딩은 밖에서 주입하므로 DB·네트워크 없이 시험할 수 있다.
// 위기 판단은 하지 않는다 — lib/safety가 먼저 걸러서 ctx.safetyHit이면 모델을 부르지 않는다.
import * as K from "./vendor/claimClassifier.mjs";
import { scoreClaims, type ClaimIndex, type Embed } from "./search.ts";

export type ClassifyCtx = {
  safetyHit?: boolean;
  scene?: string | null;
  mentioned?: string[];
  lastBot?: string | null;
  messageId?: string | null;
  chatId?: string | null;
  topK?: number;
  // 평가용: 이 문장은 후보 검색과 프롬프트 예시에서 뺀다(시험 문장이 claim 예시와 같을 때 정답이 새는 것을 막음). 운영에서는 쓰지 않는다.
  excludeText?: string | null;
};
export type ModelCall = (p: { system: string; user: string }) => Promise<string>;
export type ClassifyEvent = {
  op: "apply" | "candidate";
  event_id: string;
  root_id: string;
  source_type: "chat";
  points: number;
  link: string;
  polarity: string;
  claim_id: string;
  chat_id: string | null;
  message_id: string | null;
  evidence?: string;
  confidence: number;
};
export type ClassifyResult = {
  skipped?: "safety";
  ok?: boolean;
  claims: { claim_id: string; confidence: number; evidence?: string }[];
  events: ClassifyEvent[];
  safety_suspect?: boolean;
  scene_key?: string | null;
  none?: boolean;
  error?: string;
  candidateIds?: string[];
};

export async function classifyUtterance(
  text: string,
  ctx: ClassifyCtx,
  deps: { embed: Embed; index: ClaimIndex; callModel: ModelCall },
): Promise<ClassifyResult> {
  if (ctx.safetyHit) return { skipped: "safety", claims: [], events: [] };
  const [q] = await deps.embed([text]);
  const scores = scoreClaims(q, deps.index, ctx.excludeText);
  const kctx = { ...ctx, scores };
  const ex = ctx.excludeText?.trim();
  const strip = (xs: string[]) => (ex ? xs.filter((x) => x.trim() !== ex) : xs);
  const cands = K.candidates(text, kctx).map((c: { examples: string[]; lean: string[]; core_thoughts: string[] }) => (ex ? { ...c, examples: strip(c.examples), lean: strip(c.lean), core_thoughts: strip(c.core_thoughts) } : c));
  const prompt = K.buildPrompt(text, kctx, cands);
  const raw = await deps.callModel({ system: prompt.system, user: prompt.user });
  const res = K.validate(raw, cands);
  // 벤더(JS) 함수의 반환형은 느슨하게 추론되므로 여기서 형태를 명시한다
  return { ...res, events: res.ok ? (K.toEvents(res, ctx) as ClassifyEvent[]) : [], candidateIds: prompt.candidate_ids };
}
