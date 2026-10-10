import "server-only";
import { createAdminClient } from "./admin";

// 요청의 "Authorization: Bearer <토큰>" 헤더로 로그인한 사용자를 확인합니다.
// 토큰이 없거나 유효하지 않으면 null. 채팅 API는 null이면 요청을 거부해야 합니다.
// 익명(임시) 계정은 null로 본다(2026-10-10): 같은 Supabase 프로젝트의 쏠 아스트로 하우스가 '로그인 없이 테스트하기'에
// 익명 로그인을 쓰게 되면서, 익명 로그인을 켜면 누구나 임시 계정 토큰을 만들 수 있다 — 그 토큰으로 채팅(비용)·무료체험을
// 쓰지 못하게 서버에서 막는다(fail closed). 화면은 AuthGate가 이미 익명 세션을 로그인으로 치지 않는다.
export async function getUserIdFromAuthHeader(header: string | null): Promise<string | null> {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await createAdminClient().auth.getUser(match[1]);
  if (error || !data.user || data.user.is_anonymous === true) return null;
  return data.user.id;
}
