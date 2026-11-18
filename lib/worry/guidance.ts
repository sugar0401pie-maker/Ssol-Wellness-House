// 첫 말 → 세부 고민(CSO 엔진 worryMatch v0.4 · 해석 엔진 v3.23 · 2026-11-18) 결과를 답변 지침·저장 기록으로 바꾸는 순수 함수.
// 엔진이 만든 한 줄(받아 주는 말 ack · 기저 생각 thought.line · 부 고민 secondaryLine)은 AI 답변에 재료로 넘긴다 — 쏘웰라는 카드가 아니라 대화로 짚어 준다(엔진 안내 v3.19).
// 세부 고민은 "가장 가까워 보이는 결"일 뿐 확정이 아니다(단정·진단·유형 말 금지는 시스템 프롬프트 필수 규칙이 그대로 지킨다).

export type WorrySignals = {
  form: string | null;
  areas: string[];
  intensity: { level: "strong" | "normal"; signals: string[]; kinds: string[]; word: string | null; ack: string | null };
};

export type WorryRoute = {
  intent_id: string;
  name?: string;
  topic?: string;
  scene_key: string | null;
  scene_candidate: string | null;
  mode: "cards" | "free_talk";
  questions: string[];
  tone: "acknowledge_first" | null;
  ack: string | null;
  thought: { surface: string; first: string; second: string; line: string | null } | null;
  first_card: string | null;
  preferOptions: string[];
  secondary: string | null;
};

// 안전 응답 엔진(ssol_safety_reply v0.3)의 "힘든 메시지" = 힘듦을 직접 쓴 메시지(강도 단서 중 감정 갈래 'feeling'). 위험 판단이 아니다(그건 lib/safety).
export function isHeavyText(sig: WorrySignals | null | undefined): boolean {
  return !!sig?.intensity?.kinds?.includes("feeling");
}

const quote = (s: string) => `“${s.trim()}”`;

// 첫 답변 지침 블록(없으면 null). 순서는 엔진 안내대로: 받아 주는 한 줄 → 기저 생각 한 줄 → (주·부가 다르면) 부 고민 한 줄.
export function worryGuidanceBlock(route: WorryRoute | null, opts: { secondaryLine?: string | null } = {}): string | null {
  if (!route) return null;
  const lines: string[] = [];
  if (route.name) lines.push(`- 이용자의 첫 말은 '${route.name}' 고민에 가장 가까워 보인다(참고용 추정 — 이용자의 말이 늘 우선이고, 이 이름을 답에 쓰거나 단정하지 않는다).`);
  if (route.tone === "acknowledge_first" && route.ack?.trim()) {
    lines.push(`- 답의 맨 앞에서 힘듦을 먼저 받아 준다. 이 한 줄을 그대로 쓰거나 자연스럽게 다듬어 쓴다: ${quote(route.ack)}`);
  }
  if (route.thought?.line?.trim()) {
    lines.push(`- 공감 다음에, 겉으로 묻는 것 아래 있을 수 있는 마음을 이 한 줄로 조심스럽게 건넨다(확정하지 않는다): ${quote(route.thought.line)}`);
  }
  if (opts.secondaryLine?.trim()) lines.push(`- 두 고민이 함께 걸려 있어 보이면 이 한 줄을 덧붙일 수 있다: ${quote(opts.secondaryLine)}`);
  const qs = (route.questions ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, 2);
  if (qs.length) lines.push(`- 마지막에 질문이 필요하면 이 중 하나를 골라 한 번만 묻는다: ${qs.map(quote).join(" / ")}`);
  return lines.length ? lines.join("\n") : null;
}

// chat_sessions.worry_pick에 남기는 값 — 원문은 저장하지 않고 고른 결과·신호만(엔진 안내 v3.18 "원문 대신 이 값만 남김").
export function worryRecord(p: {
  route: WorryRoute | null;
  sig: WorrySignals | null;
  pickedBy: "model" | "top_candidate" | "none";
  candidates: { intent_id: string; score: number }[];
  reason?: string | null;
  at?: string;
}): Record<string, unknown> {
  return {
    v: 1,
    intent_id: p.route?.intent_id ?? null,
    secondary: p.route?.secondary ?? null,
    mode: p.route?.mode ?? null,
    scene_key: p.route?.scene_key ?? null,
    scene_candidate: p.route?.scene_candidate ?? null,
    picked_by: p.pickedBy,
    candidates: p.candidates.slice(0, 3).map((c) => ({ intent_id: c.intent_id, score: Math.round(c.score * 1000) / 1000 })),
    prioritized: p.reason ?? null,
    form: p.sig?.form ?? null,
    areas: p.sig?.areas ?? [],
    level: p.sig?.intensity?.level ?? null,
    signals: p.sig?.intensity?.signals ?? [],
    at: p.at ?? new Date().toISOString(),
  };
}
