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

// 2026-09-23: ssolwellnesshouse.com의 실제 가입 화면(이름·생년월일 입력 → 인증번호 받기 →
// 인증번호+비밀번호 입력 → 가입 완료)과 맞춘 흐름. 비밀번호 없이 이메일로 먼저 인증번호를
// 보내고, 인증에 성공한 뒤에야 비밀번호를 설정한다 — signUpWithEmail(위)과는 다른 흐름이라
// 별도 함수로 둔다. 이름·생년월일은 raw_user_meta_data로 함께 실어 보내서, 인증 후
// finishSignup에서 다시 꺼내 profiles에 저장한다.
export async function sendSignupOtp(
  email: string,
  meta: { display_name: string; birth_date: string },
): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: meta },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

// 이메일로 받은 인증번호를 확인한다. 성공하면 바로 로그인 상태가 된다(세션 생김).
export async function verifySignupOtp(email: string, token: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    const message = /expired|invalid/i.test(error.message)
      ? "인증번호가 올바르지 않거나 만료됐어요. 다시 받아주세요."
      : translateAuthError(error.message);
    return { ok: false, error: message };
  }
  return { ok: true };
}

// verifySignupOtp로 로그인된 상태에서 비밀번호를 설정하고, profiles에 이름·생년월일·약관
// 동의 시각을 저장해서 가입을 마무리한다.
export async function finishSignup(params: {
  password: string;
  displayName: string;
  birthDate: string;
  // 2026-09-25 owner 요청: 회원가입 화면에 닉네임·휴대전화번호·주소·마케팅 동의 추가.
  // 전부 선택 입력이라 비어 있어도 가입 자체는 진행된다.
  nickname?: string;
  phone?: string;
  address?: string;
  marketingConsent?: boolean;
}): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, error: "세션이 만료됐어요. 처음부터 다시 시도해주세요." };

  const { error: pwError } = await supabase.auth.updateUser({ password: params.password });
  if (pwError) return { ok: false, error: translateAuthError(pwError.message) };

  // .select()를 붙여서 실제로 몇 행이 바뀌었는지 확인한다 — 2026-09-24 실사용 중 발견:
  // profiles 테이블에 authenticated role의 update 권한(GRANT)이 애초에 없어서(RLS 정책만
  // 있고 기본 권한이 없던 버그, migration 20260924000000에서 수정), 에러 없이 0행만 바뀌고
  // 그대로 성공한 것처럼 넘어가던 문제가 있었다. 앞으로 비슷한 권한 문제가 또 생겨도 조용히
  // 넘어가지 않도록 방어한다.
  const { data: updatedRows, error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: params.displayName,
      birth_date: params.birthDate,
      terms_agreed_at: new Date().toISOString(),
      sensitive_data_agreed_at: new Date().toISOString(),
      nickname: params.nickname || null,
      phone: params.phone || null,
      address: params.address || null,
      marketing_consent: params.marketingConsent ?? false,
      marketing_consent_at: params.marketingConsent ? new Date().toISOString() : null,
    })
    .eq("user_id", userId)
    .select("user_id");
  if (profileError) return { ok: false, error: `가입은 됐지만 정보 저장에 실패했어요: ${profileError.message}` };
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: "가입은 됐지만 정보 저장에 실패했어요. 새로고침 후 로그인해서 다시 시도해주세요." };
  }

  return { ok: true };
}

// 2026-09-25 owner 요청: 마이페이지에서 이메일을 바꿀 땐 반드시 새 이메일로 인증번호를
// 받아 확인해야 넘어가도록 한다 — 가입 때(sendSignupOtp/verifySignupOtp)와 같은 패턴이되,
// type이 "email"이 아니라 "email_change"라는 점만 다르다. 인증에 성공하면 그 자리에서
// 바로 이메일이 바뀐다(별도 저장 단계 없음 — Supabase Auth 자체 필드라 profiles 테이블과 무관).
export async function requestEmailChange(newEmail: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 이메일을 바꿀 수 없어요." };
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

export async function verifyEmailChange(newEmail: string, token: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 이메일을 바꿀 수 없어요." };
  const { error } = await supabase.auth.verifyOtp({ email: newEmail, token, type: "email_change" });
  if (error) {
    const message = /expired|invalid/i.test(error.message)
      ? "인증번호가 올바르지 않거나 만료됐어요. 다시 받아주세요."
      : translateAuthError(error.message);
    return { ok: false, error: message };
  }
  return { ok: true };
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
