"use client";
// 테스트 결과에서 넘어온 갈 곳(챌린지·풍등)을 로그인 동안 잠깐 맡아 둔다(대표님 2026-11-25: 테스트에서 온 챌린지가 있으면 그걸로 시작, 대신 로그인하게).
// 테스트 사이트가 보내는 주소(lib/challenge/testEntry.ts — 쏠 타로 2026-11-26: /challenge?from=tarot&result=… · /lantern?from=tarot&result=…,
// 예전 /challenge?theme=<키>)로 로그인 전에 오면 여기 적어 두고 로그인 화면을 보여 준다.
// 카카오·네이버 로그인은 첫 화면으로 돌아오므로, 앱 틀(AppFrame)이 이 값을 꺼내 그 화면으로 다시 보낸다. 하루가 지나면 버린다.
import { isTestEntryTarget, testEntryTarget } from "./testEntry.ts";

const KEY = "ssol.pendingTestEntry";
const TTL_MS = 24 * 3600 * 1000;

export function savePendingEntry(target: string): void {
  if (!isTestEntryTarget(target)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ target, at: Date.now() }));
  } catch {
    /* 저장소를 못 쓰면 이메일 로그인(같은 주소로 돌아옴)만 이어진다 */
  }
}

export function takePendingEntry(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const v = JSON.parse(raw) as { target?: unknown; at?: number };
    return isTestEntryTarget(v.target) && typeof v.at === "number" && Date.now() - v.at < TTL_MS ? v.target : null;
  } catch {
    return null;
  }
}

// 지금 주소가 테스트에서 넘어온 주소면 쏘웰라 안에서 갈 곳, 아니면 null
export function entryFromLocation(): string | null {
  try {
    return testEntryTarget(window.location.pathname, window.location.search);
  } catch {
    return null;
  }
}
