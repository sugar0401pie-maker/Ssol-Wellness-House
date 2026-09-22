"use client";

import { getBrowserClient } from "./browser";

// 실제 로그인(이메일/카카오/네이버) 전용 헬퍼. ensureAnonymousSession(browser.ts)은
// 로그인 없이도 채팅을 쓸 수 있게 하던 예전 방식이라, 로그인 필수로 바뀐 뒤로는 쓰지 않는다.
// Supabase 세션은 기본적으로 브라우저 localStorage에 저장되고 자동 갱신되므로, 한 번
// 로그인하면 별도 코드 없이도 다음 방문 때 자동으로 로그인 상태가 유지된다.

export type AuthResult = { ok: boolean; error?: string; needsEmailConfirmation?: boolean };

// Supabase Auth가 돌려주는 에러 메시지는 영어라, 자주 나오는 것만 한국어로 바꿔서 보여준다.
// 목록에 없는 메시지는 원문 그대로 보여준다(안내가 아예 없는 것보다는 낫다).
function translateAuthError(message: string): string {
  const known: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해주세요.",
    "Error sending confirmation email": "가입은 됐지만 확인 메일 발송에 실패했어요. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.",
    "Email not confirmed": "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 해요.",
    "Unable to validate email address: invalid format": "이메일 형식이 올바르지 않아요.",
  };
  return known[message] ?? message;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  // 이메일 확인이 켜져 있으면 세션 없이 user만 생성된다 — 이 경우 "이메일을 확인해주세요" 안내.
  return { ok: true, needsEmailConfirmation: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

// 카카오/네이버 소셜 로그인. Supabase 프로젝트(Auth > Providers)에 해당 provider가
// 켜져 있어야 실제로 동작한다 — 꺼져 있으면 Supabase가 에러를 돌려준다.
// 네이버는 Supabase 기본 제공 목록에 없어, 프로젝트에 커스텀 OAuth provider로 등록돼 있어야 한다
// (provider 이름은 'naver'로 가정 — owner가 다르게 등록했다면 이 이름만 바꾸면 된다).
export async function signInWithOAuth(provider: "kakao" | "naver"): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.signInWithOAuth({
    // naver는 supabase-js의 내장 Provider 타입에 없는 커스텀 provider라 타입 단언이 필요하다.
    provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"],
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true }; // 성공 시 OAuth 페이지로 리다이렉트되므로 이후 코드는 보통 실행되지 않는다.
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
