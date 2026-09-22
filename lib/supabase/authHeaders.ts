"use client";

import { getStoredAccessCode } from "@/lib/security/accessCodeClient";

// API 호출에 공통으로 붙이는 헤더. ChatApp/HomeTab/MyPageTab이 전부 같은 방식으로 호출하므로
// 한 곳에 모아둔다(2026-09-22, 3탭 구조로 나누며 중복 제거).
export function authHeaders(token: string): Record<string, string> {
  const code = getStoredAccessCode();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(code ? { "X-Access-Code": code } : {}),
  };
}
