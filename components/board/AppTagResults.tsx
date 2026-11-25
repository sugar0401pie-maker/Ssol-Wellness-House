"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import type { Episode, Guide } from "@/lib/board/data";
import TagResults from "./TagResults";

// 앱 안 고민 타파의 태그 모아 보기(/worry/tag/…) — 목록은 /api/board에서 받아 태그로 거른다.
export default function AppTagResults({ tag }: { tag: string }) {
  const [data, setData] = useState<{ guides: Guide[]; episodes: Episode[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("login");
        const res = await fetch("/api/board", { headers: authHeaders(token), cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { guides: Guide[]; episodes: Episode[] };
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="h-full overflow-y-auto bg-[image:var(--sky-text-bg)] text-night-text">
      <div className="mx-auto max-w-md px-5 pb-12 pt-4">
        <Link href="/worry" className="inline-block py-2 text-[15px] text-night-soft">
          ‹ 고민 타파로 돌아가기
        </Link>
        {error && <p className="mt-6 text-[14px] text-night-yellow">지금은 글을 불러오지 못했어요. 조금 뒤에 다시 열어 주세요.</p>}
        {!data && !error && <p className="mt-6 text-[14px] text-night-dim">불러오는 중…</p>}
        {data && <TagResults tag={tag} guides={data.guides} episodes={data.episodes} basePath="/worry" />}
      </div>
    </div>
  );
}
