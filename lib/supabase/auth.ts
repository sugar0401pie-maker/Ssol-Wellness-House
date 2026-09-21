import "server-only";
import { createAdminClient } from "./admin";

// 요청의 "Authorization: Bearer <토큰>" 헤더로 로그인한 사용자(익명 포함)를 확인합니다.
// 토큰이 없거나 유효하지 않으면 null. 채팅 API는 null이면 요청을 거부해야 합니다.
export async function getUserIdFromAuthHeader(header: string | null): Promise<string | null> {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await createAdminClient().auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user.id;
}
