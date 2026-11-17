// 관리자 화면·내보내기의 "경고(alert)" 판정. 순수 함수 — 시험 가능(alerts.test.ts).
// 대표님 2026-11-17: "watch 또는 urgent가 들어간 경우 표시". 이 앱에서 두 단계는 이미 아래 근거로 기록되고 있어서 새 판정을 만들지 않고 그대로 모은다:
//  · urgent(긴급): 위기 경로(crisis)·폭력·통제 경로(violence) 응답이 나갔거나, 세션 안전 상태가 crisis이거나, 스크리닝에서 위험이 확인돼 중단(stop)됐거나, 뿌리 상태의 안전 단계가 urgent.
//  · watch(주의): 세션 안전 상태가 elevated이거나, 스크리닝 운영 검토 표시(lib/safety/screening.ts의 isWatchMarker — 애매한 답·죽음 이야기에 "아니요")이거나, 뿌리 상태에 주의 표시(caution_hold)·안전 단계 caution/high가 있는 경우.
// 새 기준이 아니라 기존 기록을 읽는 것이라, 기준이 바뀌면 lib/safety 쪽을 따라간다.
import { isWatchMarker, parseScreenMarker } from "../safety/screening.ts";

export type AlertLevel = "urgent" | "watch";
export const ALERT_RANK: Record<AlertLevel, number> = { watch: 1, urgent: 2 };
export const ALERT_LABEL: Record<AlertLevel, string> = { urgent: "URGENT(긴급)", watch: "WATCH(주의)" };

export type MessageForAlert = { route: string | null; reflection_signal_id: string | null };
export type SessionForAlert = { safety_flag: string | null; messages: MessageForAlert[] };
export type Assessment = { level: AlertLevel | null; reasons: string[] };

export const maxLevel = (a: AlertLevel | null, b: AlertLevel | null): AlertLevel | null => (!a ? b : !b ? a : ALERT_RANK[a] >= ALERT_RANK[b] ? a : b);

// 메시지 하나의 표시(대화원문 표에서 줄 색을 칠하는 데 쓴다).
export function assessMessage(m: MessageForAlert): AlertLevel | null {
  if (m.route === "crisis" || m.route === "violence") return "urgent";
  const marker = parseScreenMarker(m.reflection_signal_id);
  if (marker?.stage === "stop") return "urgent";
  if (marker && isWatchMarker(marker)) return "watch";
  return null;
}

export function assessSession(s: SessionForAlert): Assessment {
  const reasons: string[] = [];
  let level: AlertLevel | null = null;
  const raise = (l: AlertLevel, reason: string) => { level = maxLevel(level, l); reasons.push(reason); };

  if (s.safety_flag === "crisis") raise("urgent", "세션 안전 상태: 위기(crisis)");
  else if (s.safety_flag === "elevated") raise("watch", "세션 안전 상태: 주의(elevated)");

  const count = (pred: (m: MessageForAlert) => boolean) => s.messages.filter(pred).length;
  const crisis = count((m) => m.route === "crisis");
  const violence = count((m) => m.route === "violence");
  if (crisis) raise("urgent", `위기 경로 응답 ${crisis}회`);
  if (violence) raise("urgent", `폭력·통제 경로 응답 ${violence}회`);

  const markers = s.messages.map((m) => parseScreenMarker(m.reflection_signal_id)).filter((x): x is NonNullable<typeof x> => !!x);
  const stops = markers.filter((m) => m.stage === "stop").length;
  if (stops) raise("urgent", `스크리닝: 위험 확인으로 중단 ${stops}회`);
  const unclear = markers.filter((m) => m.stage === "unclear").length;
  if (unclear) raise("watch", `스크리닝: 애매한 답 ${unclear}회`);
  const okDeath = markers.filter((m) => m.kind === "suicide" && m.stage === "ok").length;
  if (okDeath) raise("watch", `스크리닝: 죽음 이야기에 "아니요" 답 ${okDeath}회`);

  return { level, reasons };
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
