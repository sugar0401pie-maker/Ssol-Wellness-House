"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import { seaArtFor } from "@/lib/challenge/seaArt";
import { drawDayCard, notoFamily } from "@/lib/challenge/card";
import { loadPhoto } from "@/lib/challenge/photos";
import {
  shortDate,
  type Challenge,
  type Method,
  type View,
} from "@/lib/challenge/state";

// 갓생러모임 화면들(/challenge, /challenge/start/…, /challenge/day/N …)이 같이 쓰는 서버 호출·상태.
// 대표님 2026-11-25: "화면 바꾸면 무조건 링크 나눠" — 한 화면 안에서 겹쳐 띄우던 단계를 주소별 페이지로 나눴고,
// 각 페이지가 열릴 때 서버(/api/challenge)에서 지금 상태를 다시 받아 그 단계가 맞는지 확인한다.

export type Payload = {
  ok: boolean;
  today: string;
  current: Challenge | null;
  history: Challenge[];
  rewarded: boolean;
  reward?: { granted: boolean; expiresAt: string | null } | null; // 쏘웰라 7일권(3일 완료 리워드)
  view: View;
  message?: string;
  n?: number;
  memo?: string | null;
};

export function notifyChallengeChanged() {
  try {
    window.dispatchEvent(new Event("ssol:challenge"));
  } catch {
    /* 무시 */
  }
}

export async function callChallenge(body?: object): Promise<Payload> {
  const token = await getAccessToken();
  if (!token) throw new Error("login");
  const res = await fetch(
    "/api/challenge",
    body
      ? {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify(body),
        }
      : { headers: authHeaders(token), cache: "no-store" },
  );
  const json = (await res.json().catch(() => ({}))) as Payload;
  if (!res.ok && !json.view) throw new Error(json.message ?? "error");
  return json;
}

export function useChallenge() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    callChallenge()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled)
          setError("챌린지를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, setData, error };
}

// 그날 스토리 카드 그리기(사진은 이 기기에 둔 것, 없으면 바다 친구 그림). 카드 메모는 쏘웰라 보통 글꼴(대표님 2026-11-25).
export function dayCardMaker(
  cid: string,
  ck: { n: number; method: Method; memo: string | null; day: string },
) {
  return () =>
    drawDayCard(
      {
        day: ck.n as 1 | 2 | 3,
        method: ck.method,
        photoUrl: ck.method === "photo" ? loadPhoto(cid, ck.n) : null,
        artUrl: seaArtFor(`${cid}:${ck.n}`),
        memo: ck.memo,
        dateLabel: shortDate(ck.day),
      },
      typeof window === "undefined" ? "sans-serif" : notoFamily(),
    );
}

// 방금 저장한 일차의 카드 화면만 자동 저장·결과 화면으로 이어 준다(다시 열면 그냥 보기). 주소에 넣지 않아 새로고침해도 다시 내려받지 않는다.
const FRESH_KEY = "ssol.challengeFreshCard";
export function markFreshCard(cid: string, n: number) {
  try {
    window.sessionStorage.setItem(FRESH_KEY, `${cid}:${n}`);
  } catch {
    /* 저장소를 못 쓰면 그냥 보기로 열린다 */
  }
}
export function readFreshCard(): string | null {
  try {
    return window.sessionStorage.getItem(FRESH_KEY);
  } catch {
    return null;
  }
}
export function clearFreshCard() {
  try {
    window.sessionStorage.removeItem(FRESH_KEY);
  } catch {
    /* 무시 */
  }
}

export const challengePaths = {
  hub: "/challenge",
  start: (theme: string) => `/challenge/start/${theme}`,
  day: (n: number) => `/challenge/day/${n}`,
  card: (n: number) => `/challenge/day/${n}/card`,
  done: (n: number) => `/challenge/day/${n}/done`,
  complete: "/challenge/complete",
  history: "/challenge/history",
};
