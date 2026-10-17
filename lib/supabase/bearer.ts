// 요청 헤더의 로그인 토큰을 읽는 순수 함수들(서버 전용 모듈과 분리해서 테스트할 수 있다 — bearer.test.ts).

// "Authorization: Bearer <토큰>" 헤더에서 토큰만 꺼낸다. 형식이 다르면 null.
export function extractBearer(header: string | null | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// 공개키로 서명을 확인한 토큰 내용(claims)에서 사용자 id를 꺼낸다. 실제로 로그인한 사용자의 토큰만 인정한다 —
// 공개용 anon 키 같은 "사용자가 아닌" 토큰은 sub가 없거나 role이 달라서 걸러지고, 익명(임시) 계정 토큰은
// is_anonymous 값으로 거른다(2026-10-17: 쏠 아스트로 하우스의 '로그인 없이 테스트하기'가 같은 Supabase 프로젝트에
// 익명 로그인을 쓰므로, getUserIdFromAuthHeader와 같은 규칙으로 모든 API에서 익명 토큰을 거부한다).
export function userIdFromClaims(
  claims: { sub?: unknown; role?: unknown; is_anonymous?: unknown } | null | undefined,
): string | null {
  if (!claims) return null;
  if (claims.role !== "authenticated") return null;
  if (claims.is_anonymous === true) return null;
  return typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
}
