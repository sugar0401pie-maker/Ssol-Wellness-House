import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { callClassifierModel, CLASSIFIER_MODEL_NAME } from "@/lib/ai/classifierModel";
import { checkOutput } from "@/lib/safety/outputCheck";
import { stripQuestions } from "@/lib/theory/compose";
import * as RS from "./vendor/rootState.mjs";
import { interpRoutes } from "./gate";
import { interpListed } from "./listed";
import { SPEC_VERSION } from "./version";
import {
  buildDiscGroups, buildRootTexts, chooseSpeak, classifyReplyRules, discPrompt, hypothesisBlock, inSpeakWindow, makeMarker,
  parseDiscChoice, parseMarker, parseReplyLabel, replyPrompt, type DiscGroup, type ReplyLabel, type RootText, type StateLite,
} from "./speak";

// 가설 말하기(개발 1·5번)와 답 받기(개발 2번) — 서버 쪽 연결(2026-10-18).
// 말하기: 답변을 만들기 전에 "이번 턴에 짐작을 건넬까"를 정하고, 건넬 때만 AI는 공감 한두 문장(질문 없이)을 쓰고 시스템이 DB의 검수된
// 반영 문장 + 확인 질문을 원문 그대로 붙인다(이론 탐색 턴과 같은 방식). 건넨 사실은 assistant 메시지의 reflection_signal_id 마커와 sw_hypothesis_log에 남긴다.
// 받기: 다음 사용자 메시지가 마커가 붙은 직전 답변에 대한 응답이면, 맞아요/아니에요/일부를 분류해 장부(확인·거절)와 판정 기록에 반영한다.
// 어떤 실패도 채팅에는 영향이 없다(말하지 않고 평소처럼 답한다). 끄기: SW_HYPOTHESIS_ENABLED=0.
type Admin = ReturnType<typeof createAdminClient>;

export type HypothesisPlan = {
  generationExtras: { dialogueMode: "hypothesis_lead" };
  compose: (reply: string, usedFallback: boolean) => Promise<string>;
  logFields: () => { reflection_signal_id?: string };
};

// ───── 문장 데이터(sw_ob_*) 10분 캐시 ─────
let dataCache: { at: number; texts: Record<string, RootText>; groups: DiscGroup[] } | null = null;
async function loadData(admin: Admin) {
  if (dataCache && Date.now() - dataCache.at < 10 * 60 * 1000) return dataCache;
  const [t, r, d] = await Promise.all([
    admin.from("sw_ob_root_texts").select("root_id,reflect_1,reflect_2,reflect_3,check_q_1,check_q_2,counter_1,counter_2,strength,sensitive").limit(1000),
    admin.from("sw_ob_roots").select("root_id,name").limit(1000),
    admin.from("sw_ob_root_discriminators").select("group_id,roots,ask,options_json").limit(1000),
  ]);
  if (t.error || r.error || d.error) throw new Error(`가설 문장 읽기 실패: ${(t.error ?? r.error ?? d.error)?.code}`);
  dataCache = { at: Date.now(), texts: buildRootTexts(t.data ?? [], r.data ?? []), groups: buildDiscGroups(d.data ?? []) };
  return dataCache;
}

async function readStates(admin: Admin, userId: string): Promise<StateLite[]> {
  const { data, error } = await admin.rpc("sw_read_ledger", { p_user: userId });
  if (error) throw new Error(`sw_read_ledger ${error.code}`);
  return Object.values(RS.hydrate(userId, data ?? [], [])) as unknown as StateLite[];
}

// ───── 말하기 ─────
export async function planHypothesis(p: {
  admin: Admin;
  userId: string;
  sessionId: string;
  route: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  theoryActive: boolean; // 이론 질문 선택 흐름이 이번 턴을 이미 쓰고 있으면 겹치지 않는다
}): Promise<HypothesisPlan | null> {
  try {
    if (process.env.SW_HYPOTHESIS_ENABLED === "0" || p.theoryActive) return null;
    if (!interpRoutes(process.env.SW_INTERP_ROUTES).has(p.route)) return null;
    const turn = p.recentMessages.filter((m) => m.role === "assistant").length + 1;
    if (!inSpeakWindow(turn)) return null;
    if (!(await interpListed(p.admin, p.userId))) return null;

    // 이 대화에서 이미 건넨 짐작들. 직전 답변의 짐작이 아직 답을 못 받았다면 지금 메시지가 그 답이므로 새 짐작을 건네지 않는다.
    const { data: shown, error } = await p.admin
      .from("chat_messages")
      .select("reflection_signal_id, reflection_response, created_at")
      .eq("session_id", p.sessionId)
      .eq("role", "assistant")
      .not("reflection_signal_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(`마커 조회 실패: ${error.code}`);
    const markers = (shown ?? []).map((m) => ({ marker: parseMarker(m.reflection_signal_id), answered: m.reflection_response != null })).filter((x) => x.marker);
    if (markers[0] && !markers[0].answered) return null;

    const { texts, groups } = await loadData(p.admin);
    const exclude = new Set<string>(Object.values(texts).filter((t) => t.sensitive || !t.check_q.length).map((t) => t.root_id));
    for (const m of markers) if (m.marker!.kind === "hyp") exclude.add(m.marker!.id);
    const asked = new Set(markers.filter((m) => m.marker!.kind === "disc").map((m) => m.marker!.id));

    const choice = chooseSpeak(await readStates(p.admin, p.userId), exclude, groups, asked);
    if (!choice) return null;

    let marker: string | null = null;
    return {
      generationExtras: { dialogueMode: "hypothesis_lead" },
      compose: async (reply, usedFallback) => {
        if (usedFallback) return reply;
        const block = choice.kind === "hypothesis" ? hypothesisBlock(texts[choice.root], turn) : choice.group.ask;
        const text = `${stripQuestions(reply)}\n\n${block}`.trim();
        // DB 문장이라 검수된 것이지만, 합친 결과도 출력 검수를 한 번 더 통과해야 한다. 걸리면 짐작 없이 AI의 앞부분만 보낸다.
        if (!block || !checkOutput(text, { usedClinicalChunk: false, clinicalBoundaryAlreadyStated: true }).ok) return stripQuestions(reply) || reply;
        const rows = await p.admin
          .from("sw_hypothesis_log")
          .insert({
            user_id: p.userId,
            chat_id: p.sessionId,
            candidates: choice.kind === "hypothesis" ? [{ root_id: choice.root, score: choice.score }] : choice.roots.map((r) => ({ root_id: r })),
            chosen_root: choice.kind === "hypothesis" ? choice.root : null,
            chosen_by: choice.kind === "hypothesis" ? "ai" : "discriminator",
            model_version: CLASSIFIER_MODEL_NAME,
            spec_version: SPEC_VERSION,
          })
          .select("id")
          .single();
        if (rows.error || !rows.data) return stripQuestions(reply) || reply; // 기록하지 못하면 말하지 않는다(답을 받을 수 없으므로)
        marker = makeMarker(choice.kind === "hypothesis" ? "hyp" : "disc", choice.kind === "hypothesis" ? choice.root : choice.group.group_id, Number(rows.data.id));
        return text;
      },
      logFields: () => (marker ? { reflection_signal_id: marker } : {}),
    };
  } catch (e) {
    console.warn("가설 말하기 계획 실패, 평소 대화로 진행:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return null;
  }
}

// ───── 답 받기 ─────
const OUTCOME: Record<ReplyLabel, "confirmed" | "partial" | "rejected" | "no_answer"> = {
  agree: "confirmed", partial: "partial", disagree: "rejected", unsure: "no_answer", topic_shift: "no_answer",
};

export async function handleAnswer(admin: Admin, p: { userId: string; sessionId: string; messageId: string; text: string; route: string }): Promise<void> {
  if (!interpRoutes(process.env.SW_INTERP_ROUTES).has(p.route)) return;
  const { data: me } = await admin.from("chat_messages").select("created_at").eq("message_id", p.messageId).maybeSingle();
  if (!me?.created_at) return;
  // 이 메시지 직전의 쏘웰라 답변들(안내 칩 같은 부가 메시지가 끼어 있을 수 있어 몇 개를 본다) 중 가장 최근의 짐작 마커.
  const { data: prev } = await admin
    .from("chat_messages")
    .select("message_id, content, reflection_signal_id, reflection_response")
    .eq("session_id", p.sessionId)
    .eq("role", "assistant")
    .lt("created_at", me.created_at)
    .order("created_at", { ascending: false })
    .limit(3);
  const target = (prev ?? []).find((m) => parseMarker(m.reflection_signal_id));
  const marker = target && parseMarker(target.reflection_signal_id);
  if (!target || !marker || target.reflection_response != null) return;

  const now = new Date().toISOString();
  const states = RS.hydrate(p.userId, (await admin.rpc("sw_read_ledger", { p_user: p.userId })).data ?? [], []) as Record<string, ReturnType<typeof RS.newRootState>>;
  const sink: unknown[] = [];
  let label: ReplyLabel | null = null;
  let chosenRoot: string | null = null;

  if (marker.kind === "hyp") {
    label = classifyReplyRules(p.text);
    if (!label) {
      try { const q = replyPrompt(target.content, p.text); label = parseReplyLabel(await callClassifierModel(q)); } catch { label = null; }
    }
    label ??= "unsure";
    const st = (states[marker.id] ??= RS.newRootState(p.userId, marker.id));
    const mapped = RS.mapReflection(label) as string;
    const opt = { event_id: `ans:${marker.id}:${marker.logId}` };
    if (mapped === "accepted" || mapped === "rejected") RS.recordAnswer(st, mapped, now, p.sessionId, sink, opt);
    else if (mapped === "partial") RS.addEvidence(st, "chat", 0.5, sink, { event_id: `${opt.event_id}:partial`, chat_id: p.sessionId, at: now, meta: { key: `${marker.id}|answer` } });
    chosenRoot = marker.id;
  } else {
    const { groups } = await loadData(admin);
    const g = groups.find((x) => x.group_id === marker.id);
    if (!g) return;
    let pick = null;
    try { pick = parseDiscChoice(await callClassifierModel(discPrompt(g, p.text)), g); } catch { pick = null; }
    if (pick && typeof pick === "object") {
      const st = (states[pick.root] ??= RS.newRootState(p.userId, pick.root));
      RS.addEvidence(st, "chat", 1.0, sink, { event_id: `disc:${g.group_id}:${marker.logId}:${pick.root}`, chat_id: p.sessionId, at: now, meta: { key: `${pick.root}|${g.group_id}` } });
      chosenRoot = pick.root; label = "agree";
    } else if (pick === "both") {
      for (const r of g.roots) {
        const st = (states[r] ??= RS.newRootState(p.userId, r));
        RS.addEvidence(st, "chat", 0.5, sink, { event_id: `disc:${g.group_id}:${marker.logId}:${r}`, chat_id: p.sessionId, at: now, meta: { key: `${r}|${g.group_id}` } });
      }
      label = "partial";
    } else label = "unsure";
  }

  if (sink.length) {
    const { error } = await admin.rpc("sw_apply_ops", { p_user: p.userId, p_ops: sink });
    if (error) throw new Error(`sw_apply_ops ${error.code}`);
  }
  await admin.from("chat_messages").update({ reflection_response: label }).eq("message_id", target.message_id);
  await admin
    .from("sw_hypothesis_log")
    .update({ outcome: OUTCOME[label], outcome_at: now, ...(marker.kind === "disc" && chosenRoot ? { chosen_root: chosenRoot } : {}) })
    .eq("id", marker.logId)
    .eq("user_id", p.userId);
}
