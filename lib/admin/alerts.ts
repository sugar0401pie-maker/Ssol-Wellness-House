// 관리자 화면·내보내기의 "경고(alert)" 판정. 순수 함수 — 시험 가능(alerts.test.ts).
// 대표님 2026-11-17: "watch 또는 urgent가 들어간 경우 표시". 이 앱에서 두 단계는 이미 아래 근거로 기록되고 있어서 새 판정을 만들지 않고 그대로 모은다.
// 2026-11-17 보정(대표님 "urgent를 너무 막 내보낸다"): 위기·폭력 고정 안내는 (가) 이용자가 위험 표현을 직접 말해 키워드로 즉시 판정된 경우와
// (나) 표현은 모호한데 AI 분류기가 안전 쪽으로 올려 고정 안내가 나간 경우(안전 설계상 "애매하면 올린다")가 섞여 있다. (나)를 URGENT로 세면 사람이 보기에
// 위험하지 않은 대화(예: 연락할지 말지 고민)까지 긴급으로 뜨므로, (가)만 URGENT로 두고 (나)는 WATCH로 둔다 — 경고에서 빠지는 것은 없다(WATCH도 표시된다).
// "명시적 표현이었는지"는 그 당시 라우터가 쓴 것과 같은 키워드 판정(lib/safety/keywordCheck)을 이용자 메시지에 다시 돌려 알아낸다(lib/admin/data.ts가 message.explicit에 넣어 준다).
// 값을 확인하지 못한 경우(explicit이 비어 있음)는 낮추지 않고 URGENT로 둔다(안전 쪽).
//  · urgent(긴급): 이용자의 위기·폭력 표현이 명시돼 고정 안내가 나갔거나, 스크리닝에서 위험이 확인돼 중단(stop)됐거나, 뿌리 상태의 안전 단계가 urgent.
//  · watch(주의): AI 분류가 모호한 표현에서 위기·폭력 신호로 올려 고정 안내가 나갔거나, 세션 안전 상태가 elevated이거나, 스크리닝 운영 검토 표시(lib/safety/screening.ts의 isWatchMarker — 애매한 답·죽음 이야기에 "아니요")이거나, 뿌리 상태에 주의 표시(caution_hold)·안전 단계 caution/high가 있는 경우.
// 새 기준이 아니라 기존 기록을 읽는 것이라, 기준이 바뀌면 lib/safety 쪽을 따라간다.
import { isWatchMarker, parseScreenMarker } from "../safety/screening.ts";

export type AlertLevel = "urgent" | "watch";
export const ALERT_RANK: Record<AlertLevel, number> = { watch: 1, urgent: 2 };
export const ALERT_LABEL: Record<AlertLevel, string> = { urgent: "URGENT(긴급)", watch: "WATCH(주의)" };

// role: 이용자 메시지 행에도 라우터가 정한 route가 붙어 있어서, "응답 횟수"는 쏘웰라 행만 센다(비어 있으면 쏘웰라 행으로 본다).
// explicit: 위기·폭력 경로 메시지에서, 이용자 글에 명시적 표현(키워드 즉시 판정)이 있었는지. false = 확인했고 없음(AI 분류 단독 판단), 비어 있음 = 모름.
export type MessageForAlert = { role?: string; route: string | null; reflection_signal_id: string | null; explicit?: boolean };
export type SessionForAlert = { safety_flag: string | null; messages: MessageForAlert[] };
export type Assessment = { level: AlertLevel | null; reasons: string[] };

export const maxLevel = (a: AlertLevel | null, b: AlertLevel | null): AlertLevel | null => (!a ? b : !b ? a : ALERT_RANK[a] >= ALERT_RANK[b] ? a : b);

const DANGER = ["crisis", "violence"] as const;
const isDangerRoute = (r: string | null): r is (typeof DANGER)[number] => r === "crisis" || r === "violence";

// 메시지 하나의 표시(대화원문 표에서 줄 색을 칠하는 데 쓴다).
export function assessMessage(m: MessageForAlert): AlertLevel | null {
  if (isDangerRoute(m.route)) return m.explicit === false ? "watch" : "urgent";
  const marker = parseScreenMarker(m.reflection_signal_id);
  if (marker?.stage === "stop") return "urgent";
  if (marker && isWatchMarker(marker)) return "watch";
  return null;
}

export function assessSession(s: SessionForAlert): Assessment {
  const reasons: string[] = [];
  let level: AlertLevel | null = null;
  const raise = (l: AlertLevel, reason: string) => { level = maxLevel(level, l); reasons.push(reason); };

  let crisisClassifierOnly = false;
  for (const kind of DANGER) {
    const rows = s.messages.filter((m) => m.route === kind);
    if (!rows.length) continue;
    const label = kind === "crisis" ? "위기" : "폭력·통제";
    const n = rows.filter((m) => m.role !== "user").length || rows.length;
    if (rows.every((m) => m.explicit === false)) {
      raise("watch", `${label} 고정 안내 ${n}회 — AI 분류가 모호한 표현에서 올린 것으로 명시적 표현은 없음(확인 필요)`);
      if (kind === "crisis") crisisClassifierOnly = true;
    } else {
      raise("urgent", `${label} 표현이 명시되어 고정 안내 ${n}회`);
    }
  }

  // 세션 안전 상태 crisis는 같은 사건에서 올라간 값이라, 위 판정이 "AI 분류 단독"으로 확인한 경우에는 따로 올리지 않는다(확인 못 한 경우는 안전 쪽으로 URGENT).
  if (s.safety_flag === "crisis" && !crisisClassifierOnly && !s.messages.some((m) => m.route === "crisis")) raise("urgent", "세션 안전 상태: 위기(crisis)");
  else if (s.safety_flag === "elevated") raise("watch", "세션 안전 상태: 주의(elevated)");

  const markers = s.messages.map((m) => parseScreenMarker(m.reflection_signal_id)).filter((x): x is NonNullable<typeof x> => !!x);
  const stops = markers.filter((m) => m.stage === "stop").length;
  if (stops) raise("urgent", `스크리닝: 위험 확인으로 중단 ${stops}회`);
  const unclear = markers.filter((m) => m.stage === "unclear").length;
  if (unclear) raise("watch", `스크리닝: 애매한 답 ${unclear}회`);
  const okDeath = markers.filter((m) => m.kind === "suicide" && m.stage === "ok").length;
  if (okDeath) raise("watch", `스크리닝: 죽음 이야기에 "아니요" 답 ${okDeath}회`);

  return { level, reasons };
}

// 이용자 메시지의 명시성 표시를 매긴다. 위기·폭력 경로의 이용자 메시지마다 explicitOf(그 글에 명시적 표현이 있는가)를 부르고, 바로 뒤 쏘웰라 응답 행은 같은 값을 물려받는다.
// 글을 읽지 못한 행(explicitOf가 undefined)은 값을 비워 둔다 → 낮추지 않는다.
export function annotateExplicit<T extends { session_id: string; role: string; route: string | null; created_at: string; explicit?: boolean }>(msgs: T[], explicitOf: (m: T) => boolean | undefined): T[] {
  const out = msgs.map((m) => ({ ...m }));
  const bySession = new Map<string, number[]>();
  out.forEach((m, i) => (bySession.get(m.session_id) ?? bySession.set(m.session_id, []).get(m.session_id)!).push(i));
  for (const idx of bySession.values()) {
    idx.sort((a, b) => out[a].created_at.localeCompare(out[b].created_at));
    const last = new Map<string, boolean | undefined>();
    for (const i of idx) {
      const m = out[i];
      if (!isDangerRoute(m.route)) continue;
      if (m.role === "user") { const v = explicitOf(m); last.set(m.route, v); if (v !== undefined) m.explicit = v; }
      else { const v = last.get(m.route); if (v !== undefined) m.explicit = v; }
    }
  }
  return out;
}

export type RootStateForAlert = { caution_hold: boolean | null; safety2_level: string | null };

// 뿌리 상태(sw_user_root_state)는 세션이 아니라 계정에 붙는다.
export function assessRootStates(rows: RootStateForAlert[]): Assessment {
  const reasons: string[] = [];
  let level: AlertLevel | null = null;
  if (rows.some((r) => r.safety2_level === "urgent")) { level = maxLevel(level, "urgent"); reasons.push("뿌리 상태 안전 단계: urgent"); }
  if (rows.some((r) => r.safety2_level === "high" || r.safety2_level === "caution")) { level = maxLevel(level, "watch"); reasons.push("뿌리 상태 안전 단계: caution/high"); }
  if (rows.some((r) => r.caution_hold === true)) { level = maxLevel(level, "watch"); reasons.push("뿌리 상태 주의 표시(caution_hold)"); }
  return { level, reasons };
}
