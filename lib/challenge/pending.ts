"use client";
// 테스트 결과에서 넘어온 챌린지(마음)를 로그인 동안 잠깐 맡아 둔다(대표님 2026-11-25: 테스트에서 온 챌린지가 있으면 그걸로 시작, 대신 로그인하게).
// 테스트 사이트가 /challenge?theme=<키>로 보내면, 로그인 전이면 여기 적어 두고 로그인 화면을 보여 준다.
// 카카오·네이버 로그인은 첫 화면으로 돌아오므로, 앱 틀(AppFrame)이 이 값을 꺼내 갓생러모임으로 다시 보낸다. 하루가 지나면 버린다.
import { isThemeKey } from "./themes.ts";

const KEY = "ssol.pendingChallengeTheme";
const TTL_MS = 24 * 3600 * 1000;

export function savePendingTheme(theme: string): void {
  if (!isThemeKey(theme)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ theme, at: Date.now() }));
  } catch {
    /* 저장소를 못 쓰면 이메일 로그인(같은 주소로 돌아옴)만 이어진다 */
  }
}

export function takePendingTheme(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const v = JSON.parse(raw) as { theme?: string; at?: number };
    return isThemeKey(v.theme) && typeof v.at === "number" && Date.now() - v.at < TTL_MS ? v.theme : null;
  } catch {
    return null;
  }
}

// 지금 주소가 테스트에서 넘어온 갓생러모임이면 그 마음 키
export function themeFromLocation(): string | null {
  try {
    if (!window.location.pathname.startsWith("/challenge")) return null;
    const t = new URLSearchParams(window.location.search).get("theme");
    return isThemeKey(t) ? t : null;
  } catch {
    return null;
  }
}
