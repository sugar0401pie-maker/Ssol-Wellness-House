// 고민 문장 DB(sw_ob_worry_utterances · sw_ob_worry_confusers) 임베딩 색인 — 첫 말과 예시 문장의 비슷함 점수를 만든다(CSO 엔진 v3.18 흐름 1단계).
// 순수 함수: 임베딩 호출은 밖에서 주입(embed). 문장마다 벡터 하나, 점수는 코사인(단위 벡터 내적). 엔진 rankIntents가 이 점수({id: 비슷함})를 받는다.

export type Embed = (texts: string[]) => Promise<number[][]>;
export type TextIndex = { ids: string[]; vecs: Float32Array[] };

export function unitVec(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  const d = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / d;
  return out;
}

export async function buildTextIndex(items: { id: string; text: string }[], embed: Embed, batch = 256): Promise<TextIndex> {
  const usable = items.filter((x) => x.id && typeof x.text === "string" && x.text.trim().length > 0);
  const ids: string[] = [], vecs: Float32Array[] = [];
  for (let i = 0; i < usable.length; i += batch) {
    const part = usable.slice(i, i + batch);
    const out = await embed(part.map((x) => x.text));
    if (out.length !== part.length) throw new Error("임베딩 개수가 요청과 다릅니다");
    part.forEach((x, k) => { ids.push(x.id); vecs.push(unitVec(out[k])); });
  }
  return { ids, vecs };
}

// 첫 말 벡터와 색인 문장마다의 비슷함 {id: 코사인}. 차원이 다르면(모델이 바뀐 경우) 빈 결과 — 부르는 쪽이 글자 비교로 돌아간다.
export function scoreAgainst(query: ArrayLike<number>, index: TextIndex): Record<string, number> {
  const out: Record<string, number> = {};
  if (!index.vecs.length || index.vecs[0].length !== query.length) return out;
  const q = unitVec(query);
  for (let i = 0; i < index.vecs.length; i++) {
    const v = index.vecs[i];
    let dot = 0;
    for (let k = 0; k < q.length; k++) dot += q[k] * v[k];
    out[index.ids[i]] = dot;
  }
  return out;
}
