import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 브라우저용 클라이언트: 공개되어도 안전한 키(NEXT_PUBLIC_*)만 사용합니다.
// 지식 테이블은 읽을 수 없고, 본인 데이터만 볼 수 있습니다(RLS).
let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null; // 환경변수가 없으면 조용히 비활성
  client = createClient(url, anonKey);
  return client;
}

// 세션이 없으면 익명 로그인(이메일 없이 임시 ID 자동 부여)을 만들고 접근 토큰을 돌려줍니다.
// 방문만 해도 계정이 생기는 것을 막기 위해, 첫 메시지를 보낼 때 호출합니다.
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
