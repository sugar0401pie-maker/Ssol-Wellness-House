import "server-only";
import { createAdminClient } from "./admin";
import { extractBearer, userIdFromClaims } from "./bearer";

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

// 2026-10-16: 앱 첫 화면에서 부르는 "읽기 전용" API용 빠른 확인. 인증 서버에 매번 물어보는 대신(약 0.2~0.5초) 토큰의 서명을
// 공개키로 직접 검증한다(첫 호출에만 공개키를 받아 오고 이후 약 1ms) — 프로젝트가 Supabase의 새 서명 키(ES256)를 쓰기 때문에 가능하다.
// 서명이 맞고 만료되지 않은 로그인 사용자 토큰만 인정하며, 변조한 토큰·공개용 anon 키는 거부된다(실측 확인).
// 직접 검증으로 확신할 수 없을 때(키 종류가 다르거나 네트워크 문제 등)는 기존 방식(getUserIdFromAuthHeader)으로 되돌아가 더 엄격한 쪽에서
// 판단한다. 한 가지 차이: 이미 삭제·정지된 계정의 토큰이 만료(최대 1시간) 전까지 통과할 수 있어서, 값을 바꾸거나 비용이 드는
// API(채팅·결제·수정)에는 쓰지 않고 자기 정보를 읽기만 하는 GET에만 쓴다.
export async function getUserIdFast(header: string | null): Promise<string | null> {
  const token = extractBearer(header);
  if (!token) return null;
  try {
    const { data, error } = await createAdminClient().auth.getClaims(token);
    if (!error) {
      const id = userIdFromClaims(data?.claims);
      if (id) return id;
    }
  } catch {
    // 아래 기존 방식으로 확인한다.
  }
  return getUserIdFromAuthHeader(header);
}
