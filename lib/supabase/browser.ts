import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sharedCookieDomain } from "./shared-cookie-domain";

// 브라우저용 클라이언트: 공개되어도 안전한 키(NEXT_PUBLIC_*)만 사용합니다.
// 지식 테이블은 읽을 수 없고, 본인 데이터만 볼 수 있습니다(RLS).
//
// 2026-09-23: 세션 저장소를 localStorage(supabase-js 기본값)에서 쿠키(@supabase/ssr)로
// 바꿨습니다. ssolwellnesshouse.com(디저트 성향 테스트) 쪽 앱과 로그인 세션을 공유하려면
// 두 앱 다 같은 상위 도메인(.ssolwellnesshouse.com)에 쿠키를 심어야 하는데, localStorage는
// 애초에 도메인 간 공유가 불가능한 저장소라 쿠키로 바꾸는 것 말고는 방법이 없습니다.
// getSession()/getAccessToken() 등 호출부는 저장소가 뭐든 동일하게 동작하므로 이 파일 밖은
// 손댈 필요가 없습니다(서버 쪽 authHeaders.ts의 Bearer 토큰 검증도 그대로 유효합니다).
let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // 배포 환경에 NEXT_PUBLIC_SUPABASE_URL/ANON_KEY가 안 채워졌을 때 조용히 실패하지 않고
    // 콘솔에 남겨서 "로그인 화면이 왜 안 되지" 같은 문제를 빨리 찾게 한다 (2026-09-23).
    console.error("Supabase 브라우저 클라이언트 초기화 실패: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY가 비어있습니다.");
    return null;
  }
  client = createBrowserClient(url, anonKey, {
    cookieOptions: { domain: sharedCookieDomain(typeof window !== "undefined" ? window.location.hostname : undefined) },
  });
  return client;
}

// 2026-09-22: 로그인이 필수가 된 뒤로 실제 화면에서는 이 대신 getAccessToken()을 쓴다.
// (AuthGate가 로그인된 사용자에게만 화면을 보여주므로, 항상 실제 세션이 있다고 가정할 수 있다.)
// 익명 로그인 자체는 과거 검증 스크립트 등에서 여전히 유효한 개념이라 함수는 남겨둔다.
export async function ensureAnonymousSession(): Promise<string | null> {
  const supabase = getBrowserClient();
  if (!supabase) return null;
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session.access_token;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("익명 로그인 실패:", error.message);
    return null;
  }
  return data.session?.access_token ?? null;
}

// 로그인 필수 화면(AuthGate로 보호된 화면)에서 쓰는 버전. 이미 로그인돼 있다고 가정하고
// 현재 세션의 접근 토큰만 가져온다 — 없으면 null(그 경우 호출한 쪽이 에러 처리).
export async function getAccessToken(): Promise<string | null> {
  const supabase = getBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
