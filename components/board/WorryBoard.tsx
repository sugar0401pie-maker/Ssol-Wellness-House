"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/supabase/authHeaders";
import {
  type Basis,
  type Episode,
  type Guide,
} from "@/lib/board/data";
import BoardView from "./BoardView";
import { LatestInsightCard } from "@/components/app/InsightsSection";
import DailyPracticeCard from "./DailyPracticeCard";

// 앱 안 고민 타파(요청문 v1.9.4 10장): 맨 위 "쏘웰라가 알게 된 마음"(대표님 2026-11-24: 고민타파에 들어가면 제일 위에) → 제목·부제 →
// 해시태그 글자 구름(이 사람에게 가까운 고민이 크게, 천천히 떠다님) → 고른 고민 패널(이름표·제목·먼저 한 줄로 3줄·글 읽기) → 고민우체국 연재.
// 글은 공개 사이트에서 가져온다(app/api/board). 못 가져오면 마지막 내용 + 작은 안내. 본문 화면은 공개 게시판(/board)과 같은 BoardView.

type Payload = {
  guides: Guide[];
  episodes: Episode[];
  upcoming?: { n: number; title: string; tag: string; publishAt: string }[];
  basis: Basis;
  stale: boolean;
};
type TokenFn = () => Promise<string | null>;

export default function WorryBoard({
  getToken = getAccessToken,
}: { getToken?: TokenFn } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("login");
        const res = await fetch("/api/board", {
          headers: authHeaders(token),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as Payload;
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 열 때 한 번
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-[image:var(--sky-text-bg)] text-night-text">
      <div
        className="mx-auto max-w-md pb-10"
        style={{ containerType: "inline-size" }}
      >
        <div className="px-5 pt-4">
          <h1 className="text-[22px] font-bold">고민 타파</h1>
        </div>
        {/* 대표님 2026-11-26 순서: 고민 타파 제목 → 오늘 이렇게 해보면 어떨까요?(홈에서 옮김) → (최근 대화 마음) → 고민우체국 → 글자 구름 */}
        <DailyPracticeCard />
        {/* 2026-11-25 대표님: "고민 타파" 제목 바로 아래에 "{닉네임}님과 최근 나눈 대화를 보면, 이런 마음이 보여요." 카드(최근 대화에서 비친 마음이 있을 때만) */}
        <div className="[&>div]:border-b-0 [&>div]:px-5 [&>div]:pb-0 [&>div]:pt-3 [&_.bg-navy-soft]:bg-night-panel [&_.bg-navy-soft]:text-night-text [&_p]:!text-inherit">
          <LatestInsightCard variant="board" />
        </div>
        <div className="px-5">
          {error && (
            <p className="mt-6 text-[13.5px] text-night-yellow">
              지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.
            </p>
          )}
          {!data && !error && (
            <p className="mt-6 text-[13.5px] text-night-dim">불러오는 중…</p>
          )}
          {data?.stale && (
            <p className="mt-1 text-[12px] text-night-yellow">
              지금은 최신 글을 못 가져왔어요. 조금 뒤에 다시 열어 주세요.
            </p>
          )}
        </div>

        {data && (
          <BoardView
            guides={data.guides}
            episodes={data.episodes}
            upcoming={data.upcoming ?? []}
            basis={data.basis}
            basePath="/worry"
          />
        )}
      </div>
    </div>
  );
}
