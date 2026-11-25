// 로그인 화면들의 주소(대표님 2026-11-25 "화면 바꾸면 무조건 링크 나눠 — 로그인·가입·비밀번호 재설정 각각 주소").
// 첫 화면 / · 로그인 /login · 비밀번호 재설정 /login/reset · 회원가입 /signup. 로그인이 필요한 화면에서 왔으면 ?next=<그 주소>로 돌아갈 곳을 들고 다닌다.
// 브라우저·테스트 모두 쓰므로 "server-only"를 넣지 않는다.
export type AuthMode = "landing" | "signin" | "signup" | "reset";

const PATH: Record<AuthMode, string> = { landing: "/", signin: "/login", reset: "/login/reset", signup: "/signup" };

export const isAuthPath = (pathname: string): boolean => pathname === "/" || pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signup";

// 돌아갈 주소는 이 사이트 안의 경로만(//다른사이트·로그인 화면 자체는 받지 않음)
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  const path = raw.split(/[?#]/)[0];
  return isAuthPath(path) ? null : raw;
}

export function authPathFor(mode: AuthMode, next: string | null): string {
  const n = safeNext(next);
  return n ? `${PATH[mode]}?next=${encodeURIComponent(n)}` : PATH[mode];
}

// 지금 화면에서 들고 갈 돌아갈 주소: 이미 ?next=가 있으면 그것, 로그인이 필요한 화면(예: /chat)이면 그 화면 자체.
export function currentNext(pathname: string, search: string): string | null {
  const fromQuery = safeNext(new URLSearchParams(search).get("next"));
  if (fromQuery) return fromQuery;
  return isAuthPath(pathname) ? null : safeNext(pathname + search);
}
