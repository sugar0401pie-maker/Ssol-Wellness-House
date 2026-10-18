// 해석 DB(sw_ob_*) 표 행 → 발화 분류기가 쓰는 데이터 모양으로 바꾸는 순수 함수들(2026-10-18).
// 분류기(vendor/claimClassifier.mjs)는 setData({ claims, scenes })로만 데이터를 받는다. 원본은 DB 표이고 JSON은 CSO 쪽 시험용이라,
// 이 변환이 CSO의 시험용 JSON과 같은 결과를 내는지 claims.test.ts가 확인한다. DB·네트워크 접근이 없어 단위 시험이 쉽다.

export type ClaimRow = {
  claim_id: string;
  label: string;
  kind: string | null;
  scenes: string | null; // "drained, grp" 처럼 쉼표로 이은 장면 키
  examples_json: unknown;
  lean_json: unknown;
  counter_json: unknown;
  core_thoughts_json: unknown;
  show_if: string | null;
  generic: boolean | string | null;
  points: number | string | null;
  signal_ids: string | null; // "ACT-S01, ACT-S02"
};
export type ClaimRootRow = { claim_id: string; root_id: string; link: string | null; polarity: string | null; cond: string | null };
export type OptionClaimRow = { option_id: string; claim_id: string | null };
export type RootNameRow = { root_id: string; name: string; nature_primary?: string | null; nature_secondary?: string | null };
export type SceneRow = { scene_key: string; name: string; module?: string | null; first_card_id?: string | null; open_when: string | null };

export type ClaimRoot = { root: string; link: string; polarity: string; cond: string; root_name: string };
export type Claim = {
  claim_id: string;
  label: string;
  kind: string;
  roots: ClaimRoot[];
  options: string[];
  scenes: string[];
  examples: string[];
  lean: string[];
  counter: string[];
  core_thoughts: string[];
  show_if: string | null;
  generic?: true;
  points?: number;
  signal_ids?: string[];
  nature?: string;
};
export type Scene = { key: string; name: string; module: string | null; first_card: string | null; open_when: string };

const list = (v: unknown): string[] => {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
  return [];
};
const csv = (s: string | null | undefined): string[] => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
const isTrue = (v: unknown) => v === true || String(v).toLowerCase() === "true" || v === "t";

export function buildClaims(claims: ClaimRow[], claimRoots: ClaimRootRow[], options: OptionClaimRow[], roots: RootNameRow[]): Claim[] {
  const rootsBy = new Map<string, ClaimRootRow[]>();
  for (const r of claimRoots) (rootsBy.get(r.claim_id) ?? rootsBy.set(r.claim_id, []).get(r.claim_id)!).push(r);
  const optsBy = new Map<string, string[]>();
  for (const o of options) if (o.claim_id) (optsBy.get(o.claim_id) ?? optsBy.set(o.claim_id, []).get(o.claim_id)!).push(o.option_id);
  const rootInfo = new Map(roots.map((r) => [r.root_id, r]));
  return claims.map((c) => {
    const generic = isTrue(c.generic);
    const out: Claim = {
      claim_id: c.claim_id,
      label: c.label,
      kind: c.kind ?? "",
      roots: (rootsBy.get(c.claim_id) ?? []).map((r) => ({
        root: r.root_id,
        link: r.link ?? "support",
        polarity: r.polarity ?? "present",
        cond: r.cond ?? "",
        root_name: rootInfo.get(r.root_id)?.name ?? "",
      })),
      options: [...(optsBy.get(c.claim_id) ?? [])].sort(), // 순서는 의미 없음 — 결과를 항상 같게 하려고 정렬
      scenes: csv(c.scenes),
      examples: list(c.examples_json),
      lean: list(c.lean_json),
      counter: list(c.counter_json),
      core_thoughts: list(c.core_thoughts_json),
      show_if: c.show_if ? c.show_if : null,
    };
    if (generic) {
      out.generic = true;
      out.points = c.points === null || c.points === "" ? 0.5 : Number(c.points);
      out.signal_ids = csv(c.signal_ids);
      const first = (rootsBy.get(c.claim_id) ?? [])[0];
      const info = first ? rootInfo.get(first.root_id) : undefined;
      // 성격은 주 성격 + 부 성격을 "/"로 이은 값("소진/주의") — CSO 시험용 JSON과 같은 표기
      const nature = info?.nature_primary ? (info.nature_secondary ? `${info.nature_primary}/${info.nature_secondary}` : info.nature_primary) : undefined;
      if (nature) out.nature = nature;
    }
    return out;
  });
}

export function buildScenes(rows: SceneRow[]): Scene[] {
  return rows.map((s) => ({ key: s.scene_key, name: s.name, module: s.module ?? null, first_card: s.first_card_id ?? null, open_when: s.open_when ?? "" }));
}
