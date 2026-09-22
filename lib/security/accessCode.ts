import "server-only";
import { timingSafeEqual } from "node:crypto";

// 접속 코드 게이트. ACCESS_CODE 환경변수를 설정하지 않으면 게이트가 꺼진 상태로 동작한다
// (로컬 개발 편의). 값을 설정하는 순간부터 /api/chat, /api/memory가 코드를 요구한다.
// 이건 강한 보안이 아니라 "링크만 아는 낯선 사람이 바로 채팅하지 못하게" 막는 최소한의 장치다.
export function isAccessCodeConfigured(): boolean {
  return !!process.env.ACCESS_CODE;
}

export function checkAccessCode(provided: string | null): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected) return true; // 게이트 비활성
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // 길이가 다르면 timingSafeEqual이 예외를 던짐
  return timingSafeEqual(a, b);
}
