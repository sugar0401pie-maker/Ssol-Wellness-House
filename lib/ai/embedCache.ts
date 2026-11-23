import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/interp/embed";
import { EMBEDDING_MODEL } from "@/lib/rag/retrieve";
import { dequantize, quantize, type QuantRow } from "./embedQuant";

// 임베딩 결과를 DB(ai_embedding_cache)에 저장해 두고 다시 쓴다 — 2026-11-23 대표님 승인(AI 비용 줄이기 1번).
// 서버가 새로 켜질 때마다 고민 문장 색인(약 2,500문장)을 OpenAI로 다시 바꾸던 비용(한 번에 약 7~9원)을 없앤다. 문장이 바뀌거나 새로 생긴 것만 새로 바꾼다.
// 저장하는 것은 문장의 지문(sha1)과 벡터뿐 — 문장 원문은 넣지 않는다(원문은 해석 DB 표에 이미 있음). 사용자 글은 여기를 거치지 않는다(검색용 질문 임베딩은 따로).
// 표가 없거나(마이그레이션 20261123000200 전) 읽기·쓰기에 실패하면 예전처럼 전부 OpenAI로 바꾼다(결과는 같고 비용만 듦). 끄기: SW_EMBED_CACHE=0.
const LOOKUP_CHUNK = 150; // 한 번에 묻는 지문 수(주소 길이 제한 안쪽)
const OPENAI_BATCH = 256;
let disabled = false;

const hashOf = (model: string, text: string) => createHash("sha1").update(`${model}\n${text}`).digest("hex");

async function lookup(admin: ReturnType<typeof createAdminClient>, hashes: string[]): Promise<Map<string, number[]>> {
  const found = new Map<string, number[]>();
  const parts: string[][] = [];
  for (let i = 0; i < hashes.length; i += LOOKUP_CHUNK) parts.push(hashes.slice(i, i + LOOKUP_CHUNK));
  const got = await Promise.all(parts.map((p) => admin.from("ai_embedding_cache").select("text_hash,dims,scale,q").eq("model", EMBEDDING_MODEL).in("text_hash", p)));
  for (const { data, error } of got) {
    if (error) throw new Error(`ai_embedding_cache 읽기 ${error.code}`);
    for (const r of (data ?? []) as (QuantRow & { text_hash: string })[]) {
      const v = dequantize(r);
      if (v) found.set(r.text_hash, v);
    }
  }
  return found;
}

// embedTexts와 같은 모양(문장 목록 → 같은 순서의 벡터 목록). 실패해도 예외 대신 OpenAI로 돌아간다 — OpenAI 실패만 예외.
export async function embedTextsCached(texts: string[]): Promise<number[][]> {
  if (disabled || process.env.SW_EMBED_CACHE === "0" || !texts.length) return embedAll(texts);
  const admin = createAdminClient();
  const hashes = texts.map((t) => hashOf(EMBEDDING_MODEL, t));
  let found: Map<string, number[]>;
  try {
    found = await lookup(admin, [...new Set(hashes)]);
  } catch (e) {
    disabled = true; // 표가 없는 등 — 이 인스턴스에서는 더 묻지 않는다
    console.warn("임베딩 저장소를 못 읽어 OpenAI로 바꿈:", e instanceof Error ? e.message.slice(0, 80) : "unknown");
    return embedAll(texts);
  }
  const missIdx = hashes.map((h, i) => (found.has(h) ? -1 : i)).filter((i) => i >= 0);
  if (missIdx.length) {
    const vecs = await embedAll(missIdx.map((i) => texts[i]));
    const rows = new Map<string, Record<string, unknown>>();
    missIdx.forEach((i, k) => {
      found.set(hashes[i], vecs[k]);
      rows.set(hashes[i], { model: EMBEDDING_MODEL, text_hash: hashes[i], ...quantize(vecs[k]) });
    });
    const list = [...rows.values()];
    for (let i = 0; i < list.length; i += 500) {
      const { error } = await admin.from("ai_embedding_cache").upsert(list.slice(i, i + 500), { onConflict: "model,text_hash", ignoreDuplicates: true });
      if (error) { console.warn("임베딩 저장 실패(다음에 다시 만듦):", error.code); break; }
    }
  }
  return hashes.map((h) => found.get(h)!);
}

async function embedAll(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += OPENAI_BATCH) out.push(...(await embedTexts(texts.slice(i, i + OPENAI_BATCH))));
  return out;
}
