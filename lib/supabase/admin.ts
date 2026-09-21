import "server-only";
import { createClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트: 모든 보안 규칙(RLS)을 우회하는 강력한 키를 사용합니다.
// "server-only" 때문에 브라우저 코드에서 이 파일을 불러오면 빌드가 실패합니다. (키 노출 방지)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase 서버 환경변수(URL, SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
