import "server-only";
import { buildApproveBody, buildReadyBody, checkApprove, parseReady, type ApproveCheck, type ReadyInput, type ReadyResult } from "./kakaopayRequest.ts";

// 카카오페이 단건 결제(직접 연동) 호출. 비밀 키(KAKAOPAY_SECRET_KEY)와 가맹점 코드(KAKAOPAY_CID)는 서버 환경변수에만 있다.
// 둘 중 하나라도 없으면 카카오페이를 쓰지 않고, 화면은 기존 토스 결제(주문서)로 자동으로 돌아간다(/api/billing/methods).
const HOST = "https://open-api.kakaopay.com/online/v1/payment";

export function kakaopayConfig(): { secret: string; cid: string } | null {
  const secret = process.env.KAKAOPAY_SECRET_KEY?.trim();
  const cid = process.env.KAKAOPAY_CID?.trim();
  return secret && cid ? { secret, cid } : null;
}

async function call(path: "ready" | "approve", secret: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${HOST}/${path}`, {
    method: "POST",
    headers: { Authorization: `SECRET_KEY ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// 카카오페이 오류 응답에서 사람이 읽을 문장만 꺼낸다(키·내부 값은 넣지 않는다).
const errText = (json: unknown, status: number) => {
  const j = json as { error_message?: unknown; extras?: { method_result_message?: unknown } } | null;
  const msg = j?.extras?.method_result_message ?? j?.error_message;
  return typeof msg === "string" && msg ? msg : `카카오페이 응답 오류(${status})`;
};

export async function kakaopayReady(input: Omit<ReadyInput, "cid">): Promise<{ ok: true; result: ReadyResult } | { ok: false; error: string }> {
  const cfg = kakaopayConfig();
  if (!cfg) return { ok: false, error: "카카오페이 결제가 아직 설정되지 않았어요." };
  try {
    const r = await call("ready", cfg.secret, buildReadyBody({ ...input, cid: cfg.cid }));
    if (!r.ok) return { ok: false, error: errText(r.json, r.status) };
    const parsed = parseReady(r.json);
    return parsed ? { ok: true, result: parsed } : { ok: false, error: "카카오페이 준비 응답을 읽지 못했어요." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "카카오페이 연결 오류" };
  }
}

export async function kakaopayApprove(p: { tid: string; orderId: string; userId: string; pgToken: string; amount: number }): Promise<ApproveCheck> {
  const cfg = kakaopayConfig();
  if (!cfg) return { ok: false, error: "카카오페이 결제가 아직 설정되지 않았어요." };
  try {
    const r = await call("approve", cfg.secret, buildApproveBody({ cid: cfg.cid, ...p }));
    if (!r.ok) return { ok: false, error: errText(r.json, r.status) };
    return checkApprove(r.json, { tid: p.tid, orderId: p.orderId, userId: p.userId, amount: p.amount });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "카카오페이 연결 오류" };
  }
}
