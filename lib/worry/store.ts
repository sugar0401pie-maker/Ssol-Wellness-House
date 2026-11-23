import "server-only";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as WM from "@/lib/interp/vendor/worryMatch.mjs";
import { worryDataFromDb } from "@/lib/interp/vendor/dbLoader.mjs";
import { embedTexts } from "@/lib/interp/embed";
import { buildTextIndex, type TextIndex } from "./textIndex";

// 고민 문장 DB(sw_ob_worry_* · 갈래 마스터 sw_ob_sub_*, CSO 묶음 v2.32 · DB v5.32)를 서버 메모리에 둔다(10분). 원본은 DB 표다.
// 예시 문장·헷갈리는 말(약 2,500개) 임베딩 색인은 처음 쓸 때 한 번 만든다(호출 10번 남짓) — 문장이 그대로면 10분마다 다시 만들지 않는다.
// 같은 시간에 여러 요청이 와도 읽기·색인 만들기는 한 번만 한다(lib/interp/dataStore.ts와 같은 방식).
type Admin = ReturnType<typeof createAdminClient>;
const TTL_MS = 10 * 60 * 1000;
// 표 목록 = 엔진 DB 로더 v0.34 worryDataFromDb가 읽는 표 그대로(v2.32: 기저 생각 → 뿌리 · 카드 보기 갈래 · 갈래 마스터 · 판정 순서 추가).
const TABLES = [
  "sw_ob_worry_intents", "sw_ob_worry_utterances", "sw_ob_worry_confusers", "sw_ob_worry_questions", "sw_ob_worry_pairs",
  "sw_ob_worry_rules", "sw_ob_worry_intensity_cues", "sw_ob_worry_thoughts", "sw_ob_worry_entry",
  "sw_ob_worry_thought_roots", "sw_ob_worry_branches", "sw_ob_worry_branch_cues", "sw_ob_worry_branch_thoughts",
  "sw_ob_sub_branches", "sw_ob_sub_branch_roots", "sw_ob_sub_criteria", "sw_ob_judge_rules",
] as const;

async function rows(admin: Admin, table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.code}`);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

type Loaded = { at: number; items: { id: string; text: string }[]; sig: string; index: Promise<TextIndex> | null };
let cache: Loaded | null = null;
let loading: Promise<Loaded> | null = null;

async function load(admin: Admin): Promise<Loaded> {
  const got = await Promise.all(TABLES.map((t) => rows(admin, t)));
  const t = Object.fromEntries(TABLES.map((name, i) => [name, got[i]]));
  const d = worryDataFromDb(t) as { utterances: { utt_id: string; text: string }[]; confusers: { conf_id: string; text: string }[]; thoughts: { status?: string }[] };
  // 기저 생각은 상태와 상관없이 모두 쓴다(2026-11-23 대표님 결정 "다 활용" — v5.32의 새 세부 고민 36개는 상태가 '운영(CSO 11-23)'이라 예전 '검수 완료만' 거름에 걸렸음).
  WM.setWorryData(d);
  const items = [...d.utterances.map((u) => ({ id: u.utt_id, text: u.text })), ...d.confusers.map((c) => ({ id: c.conf_id, text: c.text }))];
  const sig = createHash("sha1").update(items.map((x) => `${x.id}|${x.text}`).join("\n")).digest("hex");
  const index = cache && cache.sig === sig ? cache.index : null;
  return (cache = { at: Date.now(), items, sig, index });
}

// 엔진 데이터를 메모리에 올린다(강도 단서·세부 고민 정의 등). 실패하면 예외 — 부르는 쪽이 이번 메시지에서는 건너뛴다.
export function ensureWorryData(admin: Admin): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache);
  if (!loading) loading = load(admin).finally(() => { loading = null; });
  return loading;
}

// 임베딩 색인(처음 한 번 만든다). 실패하면 다음 요청에서 다시 시도한다.
export async function worryIndex(admin: Admin): Promise<TextIndex> {
  const entry = await ensureWorryData(admin);
  if (!entry.index) {
    entry.index = buildTextIndex(entry.items, embedTexts);
    entry.index.catch(() => { entry.index = null; });
  }
  return entry.index;
}
