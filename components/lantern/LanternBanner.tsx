"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { todayKeyKST } from "@/lib/safety/dailyLimit";
import { LANTERN_ENTRY_REDIRECT, entryRedirectKey } from "@/lib/lantern/config";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";

// 홈 맨 위 풍등 배너(2026-11-25, 요청문 v1.9.4 8-2장 배너 ①) — 이벤트 기간이고 아직 안 날렸을 때만 보인다(새해까지 한 번).
// 상태를 못 읽으면 보이지 않는다(홈의 다른 내용을 막지 않게). 배너 바탕은 불투명.
// 첫 접속 이동(8-3장): "/"로 들어와(?entry=1) 이벤트 중이고 아직 안 날렸고 이 기기에서 오늘 처음이면 풍등 화면으로(주소 기록은 replace — 뒤로 가기로 반복되지 않음).
export default function LanternBanner({ getToken = getAccessToken }: { getToken?: () => Promise<string | null> } = {}) {
  const [show, setShow] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/lantern", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { open?: boolean; flown?: boolean };
        if (cancelled) return;
        const due = !!json.open && !json.flown;
        setShow(due);
        // 다른 이동(예: 테스트에서 넘어온 챌린지로)이 먼저 일어났으면 건드리지 않는다
        if (window.location.pathname !== "/home" || new URLSearchParams(window.location.search).get("entry") !== "1") return;
        const key = entryRedirectKey(todayKeyKST());
        let moved = false;
        try {
          moved = window.localStorage.getItem(key) === "1";
          if (due && !moved) window.localStorage.setItem(key, "1");
        } catch {
          moved = true; // 기록을 못 남기면 매번 보내게 되니 보내지 않는다
        }
        router.replace(due && !moved && LANTERN_ENTRY_REDIRECT ? "/lantern" : "/home");
      } catch {
        /* 배너 없이 홈만 보인다 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번만 읽는다
  }, []);
  if (!show) return null;
  // 2026-11-25 대표님: 배너를 손글씨 그림("2027 소원 담아 풍등 날리기", 1200×628)으로 교체 — 글자가 그림 안이라 화면 읽기용 이름을 붙인다.
  return (
    <Link href="/lantern" aria-label="2027 소원 담아 풍등 날리기" className="ssol-banner mb-4 block overflow-hidden rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,.35)]">
      <Image src="/lantern/banner.webp" alt="2027 소원 담아 풍등 날리기" width={1200} height={400} unoptimized priority className="h-auto w-full" />
    </Link>
  );
}
