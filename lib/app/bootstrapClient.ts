"use client";

import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { createBootstrap } from "./bootstrap";

// 실제 브라우저에서 쓰는 인스턴스(토큰·fetch 연결). 로직과 시험은 bootstrap.ts에 있다.
export const bootstrap = createBootstrap({
  getToken: getAccessToken,
  fetchJson: async (path, token) => {
    const res = await fetch(path, { headers: authHeaders(token), cache: "no-store" });
    return res.ok ? ((await res.json()) as unknown) : null;
  },
  now: () => Date.now(),
});
