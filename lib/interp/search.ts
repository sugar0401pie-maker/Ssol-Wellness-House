// 발화 → 후보 claim 검색(임베딩) — 분류기의 글자 유사도(시험용)를 대신한다(2026-10-18).
// 순수 함수: 임베딩 호출은 밖에서 주입(embed). claim마다 대표 문장(이름·예시·기우는 말·기저 생각)을 각각 벡터로 만들고,
// 발화와 가장 가까운 문장의 유사도를 그 claim의 점수로 쓴다(분류기의 글자 방식과 같은 "문장별 최댓값" 규칙).
import type { Claim } from "./claims.ts";

export type Embed = (texts: string[]) => Promise<number[][]>;
export type ClaimIndex = { owners: string[]; texts: string[]; vecs: Float32Array[] };

export function claimTexts(c: Claim): string[] {
  return [c.label, ...c.examples, ...c.lean, ...c.core_thoughts].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function unit(v: number[]): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  const d = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / d;
  return out;
}

export async function buildClaimIndex(claims: Claim[], embed: Embed, batch = 256): Promise<ClaimIndex> {
  const owners: string[] = [], texts: string[] = [];
  for (const c of claims) for (const t of claimTexts(c)) { owners.push(c.claim_id); texts.push(t); }
  const vecs: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batch) {
    const part = await embed(texts.slice(i, i + batch));
    if (part.length !== Math.min(batch, texts.length - i)) throw new Error("임베딩 개수가 요청과 다릅니다");
    for (const v of part) vecs.push(unit(v));
  }
  return { owners, texts, vecs };
}

// excludeText: 평가용 — 시험 문장이 색인에 이미 들어 있으면 그 문장은 건너뛴다(정답이 새어 들어가는 것을 막음). 운영에서는 쓰지 않는다.
export function scoreClaims(query: number[], index: ClaimIndex, excludeText?: string | null): { claim_id: string; sim: number }[] {
  const q = unit(query), best = new Map<string, number>(), ex = excludeText?.trim();
  for (let i = 0; i < index.vecs.length; i++) {
    if (ex && index.texts[i].trim() === ex) continue;
    const v = index.vecs[i];
    let dot = 0;
    for (let k = 0; k < q.length; k++) dot += q[k] * v[k];
    const o = index.owners[i];
    if (dot > (best.get(o) ?? -1)) best.set(o, dot);
  }
  return [...best].map(([claim_id, sim]) => ({ claim_id, sim }));
}
