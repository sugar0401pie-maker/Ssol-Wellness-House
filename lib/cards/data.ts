// 선택지 카드 데이터: 해석 DB(sw_ob_choice_*) 행 → 카드 엔진(vendor/choiceCards.mjs)이 읽는 모양으로 바꾸는 순수 함수(2026-10-20, 로드맵 3·4번).
// 엔진은 setData()로만 데이터를 받는다. 원본은 DB 표이고 JSON은 CSO 시험용이라, 이 변환이 CSO의 시험용 JSON과 같은 결과를 내는지는
// scripts/sw_cards_verify_live.mjs가 운영 DB를 읽어 확인한다(단위 시험은 합성 행으로 변환 규칙을 확인).
export type RootLink = { root: string; points: number; cond: string; link: string; polarity: string };
export type CardOption = {
  id: string; card: string; text: string; kind: string; node: string; roots: RootLink[]; rank_roots: string[]; base_rank: number;
  show_if: string | null; gate: string | null; next_card: string | null; core_thought: string | null; lean: string; counter: string;
  practice: Record<string, unknown> & { candidates: PracticeCandidate[] }; note: string; meaning_key: string; claim_id: string;
};
export type PracticeCandidate = { practice_id: string; title: string; root: string; relation: string; review_status: string; auto_expose: boolean };
export type Card = { id: string; module: string; level: number; when: string; lead: string; parent_option: string | null; show: number; style: string };
export type CardData = {
  scenes: { key: string; name: string; module: string; first_card: string; open_when: string }[];
  cards: Record<string, Card>;
  options: Record<string, CardOption>;
  fixed: { id: string; text: string; effect: string }[];
  confirm: { id: string; template: string; options: { id: string; text: string; effect: string }[] };
};

export type SceneRow = { scene_key: string; name: string; module: string | null; first_card_id: string | null; open_when: string | null };
export type CardRow = { card_id: string; module: string | null; level: number | null; open_when: string | null; lead_text: string | null; parent_option_id: string | null; show_n: number | null; card_style: string | null };
export type OptionRow = {
  option_id: string; card_id: string; text: string; kind: string | null; node_id: string | null; roots_json: unknown; rank_roots: string | null; base_rank: number | null;
  show_if: string | null; next_card_id: string | null; core_thought: string | null; lean_utterance: string | null; counter_utterance: string | null;
  practice_json: unknown; note: string | null; meaning_key: string | null; claim_id: string | null;
};
export type FixedRow = { fixed_id: string; text: string; effect: string | null };
export type ConfirmRow = { confirm_id: string; template: string; text: string; effect: string | null };
export type PracticeRow = { option_id: string; practice_id: string; title: string | null; root_id: string | null; relation: string | null; review_status: string | null; auto_expose: boolean | null };

const json = <T,>(v: unknown, fallback: T): T => {
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return (v ?? fallback) as T;
};

// 🔸 "본인이 먼저 말했을 때만" 보기의 열쇠. CSO 데이터에서는 체중·몸매만 body_image이고 나머지 열두 개는 모두 같은 열쇠(health)를 쓴다.
// 서버는 사용자가 그 주제를 먼저 말했는지 아직 판정하지 않으므로(ctx.mentioned가 비어 있음) 이 보기들은 기본으로 숨겨진다(더 조심스러운 쪽).
export const gateOf = (showIf: string | null | undefined): string | null => (!showIf ? null : showIf.includes("체중·몸매") ? "body_image" : "health");

const FIXED_ORDER = ["FX-MULTI", "FX-DK", "FX-OTHER"];

export function buildCardData(p: { scenes: SceneRow[]; cards: CardRow[]; options: OptionRow[]; fixed: FixedRow[]; confirm: ConfirmRow[]; practices: PracticeRow[] }): CardData {
  const candBy = new Map<string, PracticeCandidate[]>();
  for (const r of p.practices) {
    const c: PracticeCandidate = { practice_id: r.practice_id, title: r.title ?? "", root: r.root_id ?? "", relation: r.relation ?? "", review_status: r.review_status ?? "", auto_expose: !!r.auto_expose };
    (candBy.get(r.option_id) ?? candBy.set(r.option_id, []).get(r.option_id)!).push(c);
  }
  const cards: Record<string, Card> = {};
  for (const c of p.cards) cards[c.card_id] = { id: c.card_id, module: c.module ?? "", level: c.level ?? 1, when: c.open_when ?? "", lead: c.lead_text ?? "", parent_option: c.parent_option_id ?? null, show: c.show_n ?? 3, style: c.card_style ?? "abc" };
  const options: Record<string, CardOption> = {};
  for (const o of p.options) {
    const roots = json<Partial<RootLink>[]>(o.roots_json, []).map((r) => ({ root: r.root ?? "", points: Number(r.points ?? 0), cond: r.cond ?? "", link: r.link ?? "support", polarity: r.polarity ?? "present" }));
    options[o.option_id] = {
      id: o.option_id, card: o.card_id, text: o.text, kind: o.kind ?? "", node: o.node_id ?? "", roots,
      rank_roots: (o.rank_roots ?? "").split(",").map((x) => x.trim()).filter(Boolean), base_rank: Number(o.base_rank ?? 0),
      show_if: o.show_if ?? null, gate: gateOf(o.show_if), next_card: o.next_card_id ?? null, core_thought: o.core_thought ?? null,
      lean: o.lean_utterance ?? "", counter: o.counter_utterance ?? "",
      practice: { ...json<Record<string, unknown>>(o.practice_json, {}), candidates: candBy.get(o.option_id) ?? [] },
      note: o.note ?? "", meaning_key: o.meaning_key ?? "", claim_id: o.claim_id ?? "",
    };
  }
  const conf = p.confirm;
  return {
    scenes: p.scenes.map((s) => ({ key: s.scene_key, name: s.name, module: s.module ?? "", first_card: s.first_card_id ?? "", open_when: s.open_when ?? "" })),
    cards, options,
    // 화면에 보이는 순서(두 개 이상 → 잘 모르겠어요 → 다른 이유)를 DB 행 순서와 무관하게 고정한다.
    fixed: [...p.fixed].sort((a, b) => FIXED_ORDER.indexOf(a.fixed_id) - FIXED_ORDER.indexOf(b.fixed_id)).map((f) => ({ id: f.fixed_id, text: f.text, effect: f.effect ?? "" })),
    confirm: { id: "CC-CONFIRM", template: conf[0]?.template ?? "", options: conf.map((c) => ({ id: c.confirm_id, text: c.text, effect: c.effect ?? "" })) },
  };
}
