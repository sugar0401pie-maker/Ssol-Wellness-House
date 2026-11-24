// 채팅 이용 코드(오프라인 웰니스 세션 패키지용, 2026-11-24 대표님 요청) — 순수 함수. 사이트 접속 코드(lib/security/accessCode.ts)와는 다른 것.
// 코드: 헷갈리는 글자(0·O·1·I·L)를 뺀 대문자·숫자 31자 중 12자(약 59비트 — 아무렇게나 넣어 맞히기 어려움), 보기 좋게 4자리씩 하이픈.
// 입력은 대소문자·공백·하이픈을 무시한다. DB에는 원문 대신 sha256 지문만(supabase/migrations/20261124000000).
// "server-only"를 넣지 않는다(시험·관리 도구가 바로 읽는다).
import { createHash, randomInt } from "node:crypto";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 12;

export function normalizeChatCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{10,32}$/.test(s) ? s : null;
}

export const hashChatCode = (normalized: string): string => createHash("sha256").update(normalized).digest("hex");

export function generateChatCode(len = CODE_LENGTH, pick: (n: number) => number = randomInt): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return s;
}

export const formatChatCode = (normalized: string): string => normalized.match(/.{1,4}/g)!.join("-");

export type RedeemReason = "ok" | "not_found" | "expired" | "used_up" | "already_yours" | "invalid";

// 화면 문구(결과마다). ok는 만료일을 함께 보여 준다.
export function redeemMessage(reason: RedeemReason): string {
  switch (reason) {
    case "ok": return "코드가 등록됐어요.";
    case "invalid": return "코드 형식을 다시 확인해 주세요. 영문과 숫자 10자리 이상이에요.";
    case "not_found": return "등록할 수 없는 코드예요. 받은 코드를 다시 확인해 주세요.";
    case "expired": return "등록 기간이 지난 코드예요. 세션 담당자에게 문의해 주세요.";
    case "used_up": return "이미 사용된 코드예요. 세션 담당자에게 문의해 주세요.";
    case "already_yours": return "이미 이 계정에 등록한 코드예요.";
  }
}
