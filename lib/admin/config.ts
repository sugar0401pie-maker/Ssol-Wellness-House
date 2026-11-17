// 관리자 판별(순수 함수 — 네트워크 없이 시험한다). 2026-11-17 대표님 지시: 관리자는 seotaiji0124@naver.com 카카오 계정 한 곳.
// 판별은 이메일만 보지 않고 "카카오로 가입한 계정"인지까지 본다 — 다른 방식(이메일·비밀번호 등)으로 같은 이메일을 만들어도 통과하지 못하게.
// 이 판별을 통과해도 관리자 암호를 한 번 더 입력해야 화면·자료가 열린다(lib/admin/session.ts).
export const DEFAULT_ADMIN_EMAIL = "seotaiji0124@naver.com";

// 환경변수 ADMIN_EMAILS(쉼표로 구분)가 있으면 그 목록을, 없으면 기본 한 곳만 쓴다. 비어 있는 값은 무시한다.
export function adminEmails(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return raw && raw.length ? raw : [DEFAULT_ADMIN_EMAIL];
}

export type AuthUserLike = {
  email?: string | null;
  is_anonymous?: boolean;
  app_metadata?: { provider?: string; providers?: string[] } | null;
  identities?: { provider?: string }[] | null;
};

export function usesKakao(user: AuthUserLike): boolean {
  const meta = user.app_metadata;
  return meta?.provider === "kakao" || !!meta?.providers?.includes("kakao") || !!user.identities?.some((i) => i.provider === "kakao");
}

export function isAdminUser(user: AuthUserLike | null | undefined, emails: string[] = adminEmails()): boolean {
  if (!user || user.is_anonymous === true) return false;
  const email = user.email?.trim().toLowerCase();
  return !!email && emails.includes(email) && usesKakao(user);
}
