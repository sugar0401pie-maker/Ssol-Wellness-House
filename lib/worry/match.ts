import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import * as WM from "@/lib/interp/vendor/worryMatch.mjs";
import { callClassifierModel } from "@/lib/ai/classifierModel";
import { ensureWorryData, worryIndex } from "./store";
import { scoreAgainst } from "./textIndex";
import { worryRecord, type WorryRoute, type WorrySignals } from "./guidance";

// 첫 말 → 세부 고민 → 장면·대화(CSO 해석 엔진 v3.18~v3.19 서버 흐름, 2026-11-18 3부-2).
// ① 강도 재기(signalsOf — 위험 판단 아님) ② 후보 찾기(임베딩 점수 → rankIntents → prioritize) ③ 고르기(pickPrompt → 분류 모델 → parsePick)
// ④ 잇기(routeFor — 기존 장면이면 카드, 아니면 자유 대화 + 받아 주는 한 줄 · 기저 생각 한 줄).
// 끄기: SW_WORRY_MATCH=0. 어디서 실패해도 채팅은 평소대로 간다(이 결과 없이 답한다).
type Admin = ReturnType<typeof createAdminClient>;

export const worryMatchOn = () => process.env.SW_WORRY_MATCH !== "0";

function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<null>((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t));
}

// 모든 메시지: 힘듦을 직접 쓴 말인지 재는 데 쓴다(안전 응답 엔진의 "힘든 메시지" 세기). 데이터를 못 읽으면 null(세지 않음).
export async function worrySignals(admin: Admin, text: string): Promise<WorrySignals | null> {
  if (!worryMatchOn()) return null;
  try {
    const ok = await within(ensureWorryData(admin), 1500);
    if (!ok) return null;
    return WM.signalsOf(text) as WorrySignals;
  } catch {
    return null;
  }
}

export type WorryMatch = { route: WorryRoute; secondaryLine: string | null; record: Record<string, unknown> };

// 대화의 첫 사용자 말에서만 부른다. 고른 세부 고민이 없으면(모델이 "어느 것도 아님") null.
export async function matchFirstWorry(p: { admin: Admin; text: string; queryEmbedding?: Promise<number[]> }): Promise<WorryMatch | null> {
  if (!worryMatchOn()) return null;
  try {
    if (!(await within(ensureWorryData(p.admin), 2000))) return null;
    const sig = WM.signalsOf(p.text) as WorrySignals;
    // 임베딩 점수: 색인이 아직 없거나(인스턴스가 막 뜬 경우) 늦으면 엔진의 글자 비교로 대신한다(후보 3개를 고르는 데까지만 쓰이고 최종 선택은 모델이 한다).
    const [index, query] = await Promise.all([
      within(worryIndex(p.admin), 4000).catch(() => null),
      p.queryEmbedding ? within(p.queryEmbedding, 4000).catch(() => null) : Promise.resolve(null),
    ]);
    const scores = index && query ? scoreAgainst(query, index) : null;
    const usable = scores && Object.keys(scores).length ? scores : null;
    let cands = WM.rankIntents(p.text, usable ? { scores: usable, confScores: usable } : {}) as { intent_id: string; score: number }[];
    if (!cands.length) return null;
    const pr = WM.prioritize(cands, p.text) as { cands: typeof cands; reason: string | null; secondary?: string };
    cands = pr.cands;
    // 되묻기(clarifyFor)는 아직 화면이 없어 쓰지 않는다 — 대신 모델이 주·부 고민 둘을 함께 고를 수 있다.
    let pick: { intent_id: string | null; secondary: string | null } | null = null;
    let pickedBy: "model" | "top_candidate" = "model";
    const raw = await within(callClassifierModel({ system: "너는 고민 분류기다. 반드시 JSON 한 개만 출력한다.", user: WM.pickPrompt(p.text, cands) }), 8000).catch(() => null);
    if (raw) pick = WM.parsePick(raw, cands) as { intent_id: string | null; secondary: string | null };
    if (!raw) { pick = { intent_id: cands[0].intent_id, secondary: null }; pickedBy = "top_candidate"; } // 모델이 늦거나 실패하면 1위 후보
    if (!pick?.intent_id) return null;
    const secondary = pick.secondary ?? pr.secondary ?? null;
    const route = WM.routeFor(pick.intent_id, null, { secondary, intensity: sig.intensity }) as WorryRoute | null;
    if (!route) return null;
    const secondaryLine = route.secondary ? (WM.secondaryLine(route.intent_id, route.secondary) as string | null) : null;
    return { route, secondaryLine, record: worryRecord({ route, sig, pickedBy, candidates: cands, reason: pr.reason }) };
  } catch (e) {
    console.warn("세부 고민 고르기 실패, 평소 대화로 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}
