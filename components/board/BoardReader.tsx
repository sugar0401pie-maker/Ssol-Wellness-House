"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import type { Episode, Guide } from "@/lib/board/data";
import ReaderView from "./ReaderView";

// 글 읽기 화면(요청문 v1.9.4 10-4·10-5장). 하단 메뉴는 숨긴다(BottomNav가 /worry/… 에서 숨김).
// 본문은 공개 사이트 글을 허용한 태그만 남겨 보여 준다(서버가 거른 HTML). 공개 글의 대화 예시·만화·FAQ는 대표님이 정하기 전이라 본문과 "먼저 한 줄로"만.
// 원래 주소는 글자로(링크로 바꿀지는 정해야 함 — 링크면 로그인 흐름 밖으로 나감).

type Payload = {
  kind: "guide" | "post";
  guide?: Guide;
  episode?: Episode;
  html: string | null;
  stale: boolean;
};

export default function BoardReader({
  kind,
  id,
  getToken = getAccessToken,
}: {
  kind: "guide" | "post";
  id: string;
  getToken?: () => Promise<string | null>;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("login");
        const res = await fetch(
          `/api/board/article?kind=${kind}&id=${encodeURIComponent(id)}`,
          { headers: authHeaders(token), cache: "no-store" },
        );
        const j = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? "error");
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled)
          setError(
            (e as Error).message === "글을 찾지 못했어요."
              ? "글을 찾지 못했어요."
              : "지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, [kind, id]);

  return (
    <div className="h-full overflow-y-auto bg-[image:var(--sky-text-bg)] text-night-text">
      <div className="mx-auto max-w-md px-5 pb-12 pt-4">
        <Link
          href="/worry"
          className="inline-block py-2 text-[15px] text-night-soft"
        >
          ‹ 고민 타파로 돌아가기
        </Link>
        {error && <p className="mt-6 text-[14px] text-night-yellow">{error}</p>}
        {!data && !error && (
          <p className="mt-6 text-[14px] text-night-dim">불러오는 중…</p>
        )}
        {data && (
          <ReaderView
            guide={data.guide}
            episode={data.episode}
            html={data.html}
            stale={data.stale}
            isPublic={false}
          />
        )}
      </div>
    </div>
  );
}
