import { NextResponse } from "next/server";
import { episodeCover } from "@/lib/board/data";
import { loadEpisodes, upcomingEpisodes } from "@/lib/board/fetchSite";
import { TAROT_NAME, TAROT_URL, promoFor, promoIndex } from "@/lib/board/promo";
import { splitTags } from "@/lib/board/tags";

// 고민우체국 공개 데이터(대표님 2026-11-26: 공개 사이트 www.ssolwellnesshouse.com/postoffice에도 글 전체를 올림).
// 로그인 없이 /board에서 이미 보이는 내용만 내보낸다 — 공개된 회차의 본문, 예약 회차는 제목·태그·날짜만. 광고 문구는 앱과 같은 조합.
// 본문은 앱에 있는 것(bodyHtml)만 쓴다: 없을 때 글 주소(공개 사이트)를 가져오면 그 페이지가 다시 이 주소를 부르게 된다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const list = await loadEpisodes();
  const episodes = list.data.map((e) => ({
    n: e.n,
    title: e.title,
    summary: e.summary,
    tags: splitTags(e.tags?.length ? e.tags : [e.tag]),
    cover: e.image ?? episodeCover(e.n),
    images: e.images ?? [],
    html: e.bodyHtml ?? null,
    promo: promoFor(promoIndex("post", e.n)),
  }));
  return NextResponse.json(
    { episodes, upcoming: upcomingEpisodes(), tarot: { name: TAROT_NAME, url: TAROT_URL } },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } },
  );
}
