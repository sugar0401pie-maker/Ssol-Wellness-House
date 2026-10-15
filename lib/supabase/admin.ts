import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트: 모든 보안 규칙(RLS)을 우회하는 강력한 키를 사용합니다.
// "server-only" 때문에 브라우저 코드에서 이 파일을 불러오면 빌드가 실패합니다. (키 노출 방지)
// 2026-10-16: 요청마다 새로 만들지 않고 한 번 만든 것을 재사용한다(앱 첫 로딩 속도 개선). 이 클라이언트는 로그인 상태를
// 저장하지 않으므로(persistSession false) 요청끼리 섞일 염려가 없고, 같은 인스턴스에서 토큰 서명 검증용 공개키(JWKS)를
// 캐시해 두고 계속 쓸 수 있다(lib/supabase/auth.ts의 getUserIdFast).
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase 서버 환경변수(URL, SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
